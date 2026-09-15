"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { MessageType } from "@bridge/shared"

// WEBRTC  imports
import {
	addIceCandidate,
	createAnswer,
	createDataChannel,
	createOffer,
	createPeerConnection,
	sendFile,
	setRemoteAnswer,
	setRemoteOffer,
} from "../lib/webrtc"
import {
	getDeviceID,
	hasDeviceID,
	getDeviceName,
	setDeviceNameInLocalstorage,
} from "../lib/device"

import DeviceIcon from "../components/DeviceIcon"

import { getLocalDeviceInfo, type DeviceInfo } from "../lib/deviceInfo"

import {
	createDeviceInfoMessage,
	parseDeviceInfoMessage,
} from "../lib/deviceExchange"

import Intro from "../components/Intro"
import StrokeText from "../components/StrokeText"

import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import CodeInput from "../components/CodeInput"
import React from "react"

import { Flip } from "gsap/Flip"

import type {
	P2PMessage,
	RoomMessage,
	RoomDevice,
	RoomState,
	IncomingFileTransfer,
} from "../lib/types"

gsap.registerPlugin(Flip)

export default function Home() {
	const socket = useRef<WebSocket | null>(null)
	const peerREF = useRef<RTCPeerConnection | null>(null)
	const myRole = useRef<"HOST" | "GUEST" | null>(null)
	const peerId = useRef<string | null>(null)
	const dataChannel = useRef<RTCDataChannel | null>(null)
	const pendingCandidates = useRef<RTCIceCandidateInit[]>([]) // state to store the ice candidates if the offer-answer cyclis still in process

	const joinButtonRef = useRef<HTMLButtonElement | null>(null)

	const incomingFiles = useRef<Map<string, IncomingFileTransfer>>(new Map())

	const roomIncomingFiles = useRef<
		Map<string, Map<string, IncomingFileTransfer>>
	>(new Map())

	// const roomPeerTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
	//   new Map()
	// );

	const hasInitialRoomAnimationPlayed = useRef(false)

	// GSAP REFS
	const heroRef = useRef<HTMLDivElement>(null)
	const Container = useRef<HTMLDivElement>(null)
	const heroTL = useRef<gsap.core.Timeline | null>(null)
	const afterIntroTL = useRef<gsap.core.Timeline | null>(null)
	const roomJoinedAnimationTl = useRef<gsap.core.Timeline | null>(null)
	const RefreshTL = useRef<gsap.core.Timeline | null>(null)
	const introRef = useRef<HTMLDivElement>(null)

	const roomsRef = useRef<Map<string, RoomState>>(new Map())

	const getRoomState = (roomCode: string) => {
		return roomsRef.current.get(roomCode)
	}

	const [connected, setConnected] = useState(false)
	const [message, setMessage] = useState("") // state for current message

	const [receivedMessages, setReceivedMessages] = useState<P2PMessage[]>([])


	const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null)
	const [dataChannelOpen, setDataChannelOpen] = useState(false) // state for kkeping track of connection
	const [sessionCode, setSessionCode] = useState("") // usestate for storing the code from next browser

	const [roomCode, setRoomCode] = useState<string>("")
	const [displayRoomCode, setDisplayRoomCode] = useState<string>("")


	const [needsDeviceSetup, setNeedsDeviceSetup] = useState(true)
	const [isHeroAnimationDone, setIsHeroAnimationDone] = useState(false)

	const [isNewUser, setIsNewUser] = useState(false) // state to determine which animation to play
	const [isSettled, setIsSettled] = useState(false) // To track if we've checked localStorage

	const [deviceName, setDeviceNameState] = useState("My Device")

	const [activeTab, setActiveTab] = useState("room")

	const [rooms, setRooms] = useState<Record<string, RoomState>>({})

	const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)

	const [remoteDeviceInfo, setRemoteDeviceInfo] = useState<
		Record<string, DeviceInfo>
	>({})

	const [deviceFiles, setDeviceFiles] = useState<Record<string, File | null>>(
		{},
	)
	const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({})

	const [myDeviceName, setMyDeviceName] = useState<string | null>("")

	const [expandedDevice, setExpandedDevice] = useState<string | null>(null)

	const [expanded, setExpanded] = useState(false)

	const [showJoinInput, setShowJoinInput] = useState(false) // to detremine wether to show join dialog box or not
	const [joinDialogueCode, setJoinDialogueCode] = useState<string>("")

	const createRoomState = (
		roomCode: string,
		devices: RoomDevice[] = [],
	): RoomState => {
		const existingRoom = roomsRef.current.get(roomCode)

		if (existingRoom) {
			existingRoom.devices = devices
			return existingRoom
		}

		const room: RoomState = {
			roomCode,
			devices,
			peerStatus: {},
			peers: new Map(),
			dataChannels: new Map(),
			pendingCandidates: new Map(),
			messages: [],
			selectedFiles: {},
			peerTimers: new Map(),
			deviceMessages: {},
			remoteDeviceInfo: {},
		}

		roomsRef.current.set(roomCode, room)

		setRooms((prev) => ({
			...prev,
			[roomCode]: room,
		}))

		return room
	}

	const activeRoom = activeRoomCode
		? (roomsRef.current.get(activeRoomCode) ?? null)
		: null

	const activeRoomDevices = activeRoom?.devices ?? []

	const joinDialogueInputRef = useRef<HTMLInputElement>(null)

	useLayoutEffect(() => {
		const info = getLocalDeviceInfo()

		setDeviceInfo(info)

		if (!hasDeviceID()) {
			setDeviceNameState(info.deviceType)

			setNeedsDeviceSetup(true)
			setIsNewUser(true)
			setIsSettled(true)

			return
		}

		setIsSettled(true)
	}, [])

	// creating useEffect to connect device in the start if its already registered on server
	useEffect(() => {
		if (hasDeviceID()) {
			connect()
		}
	}, [])

	// Add this useEffect inside your component to listen for the Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (showJoinInput) setShowJoinInput(false)
				if (roomCode) setRoomCode("") // Or clear the active room code state
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [showJoinInput, roomCode])

	useEffect(() => {
		if (showJoinInput) {
			joinDialogueInputRef.current?.focus()
		}
	}, [showJoinInput])

	// WHOLE IMPLEMENTATION IS BELOW

	const connect = () => {
		socket.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL!)

		socket.current.onopen = () => {
			setConnected(true)

			const deviceId = getDeviceID()
			const deviceName = getDeviceName()

			setMyDeviceName(deviceName)

			socket.current!.send(
				JSON.stringify({
					type: MessageType.DEVICE_REGISTER,
					payload: {
						deviceId,
						deviceName: deviceName,
					},
				}),
			)
		}

		// when socket receive message do this
		socket.current.onmessage = async (event) => {
			const data = JSON.parse(event.data)

			switch (data.type) {
				case MessageType.CLIENT_ID:
					break

				case MessageType.SESSION_CREATED:
					break

				case MessageType.SESSION_JOINED: {
					peerREF.current = createPeerConnection((candidate) => {
						if (candidate) {
							socket.current?.send(
								JSON.stringify({
									type: MessageType.ICE_CANDIDATE,

									payload: {
										targetId: peerId.current,
										candidate,
									},
								}),
							)
						}
					})

					myRole.current = data.payload.role
					peerId.current = data.payload.peerId

					// ONLY RUN THIS CODE IF ITS HOST BROWSER <-------------------------  ###
					if (myRole.current === "HOST") {
						dataChannel.current = createDataChannel(
							peerREF.current!,
							() => {
								setDataChannelOpen(true)
							},
							() => {
								setDataChannelOpen(false)
							},
							(message) => {
								if (typeof message === "string") {
									const data = JSON.parse(message)

									// -------------------------
									// FILE START
									// -------------------------

									if (data.type === "FILE_START") {
										const transferId = data.payload.transferId

										incomingFiles.current.set(peerId.current!, {
											transferId,
											data: [],
											name: data.payload.name,
											size: data.payload.size,
											mimeType: data.payload.mimeType,
											totalChunks: data.payload.totalChunks,
											chunkSize: data.payload.chunkSize,
											receivedChunks: 0,
											startTime: performance.now(),
										})

										console.log(`📥 Receiving ${data.payload.name}`)

										return
									}

									
									// -------------------------
									// FILE END
									// -------------------------

									if (data.type === "FILE_END") {
										const transferId = data.payload.transferId

										const transfer = incomingFiles.current.get(peerId.current!)

										if (!transfer) {
											console.error("Received FILE_END without FILE_START")
											return
										}

										if (transfer.transferId !== transferId) {
											console.error("Transfer ID mismatch")
											return
										}

										if (transfer.receivedChunks !== transfer.totalChunks) {
											console.error(
												`Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`,
											)
											return
										}

										const endTime = performance.now()

										const seconds = (
											(endTime - transfer.startTime) /
											1000
										).toFixed(2)

										const blob = new Blob(transfer.data, {
											type: transfer.mimeType,
										})

										const url = URL.createObjectURL(blob)

										const link = document.createElement("a")

										link.href = url
										link.download = transfer.name

										link.click()

										URL.revokeObjectURL(url)

										console.log(`✅ Received ${transfer.name} in ${seconds}s`)

										setReceivedMessages((prev) => [
											...prev,
											{
												id: data.payload.messageId ?? crypto.randomUUID(),
												text: `📥 ${transfer.name} received in ${seconds}s`,
												direction: "received",
											},
										])

										incomingFiles.current.delete(peerId.current!)

										return
									}
									// -------------------------
									// CHAT MESSAGE
									// -------------------------

									if (data.type === "CHAT_MESSAGE") {
										setReceivedMessages((prev) => [
											...prev,
											{
												id: data.payload.messageId ?? crypto.randomUUID(),
												text: data.payload.text,
												direction: "received",
											},
										])

										return
									}

									console.log("Unknown DataChannel message:", data)

									return
								}

								// -------------------------
								// BINARY CHUNK
								// -------------------------

								if (message instanceof ArrayBuffer) {
									const transfer = incomingFiles.current.get(peerId.current!)

									if (!transfer) {
										console.error(
											"Received chunk but no active transfer exists",
										)
										return
									}

									transfer.data.push(message)
									transfer.receivedChunks++

									console.log(
										`📥 Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`,
									)
								}
							},
						)

						const offer = await createOffer(peerREF.current!)
						socket.current?.send(
							JSON.stringify({
								type: MessageType.OFFER,
								payload: {
									targetId: peerId.current,
									offer,
								},
							}),
						)

						console.log("Offer sent")
					}

					// ONLY RUN THIS CODE IF ITS GUEST BROWSER <-------------------------  ###
					if (myRole.current === "GUEST") {
						peerREF.current.ondatachannel = (event) => {
							const channel = event.channel
							dataChannel.current = channel

							channel.onopen = () => {
								console.log("🟢 DataChannel OPEN")
								setDataChannelOpen(true)
							}

							channel.onclose = () => {
								console.log("🔴 DataChannel CLOSED")
								setDataChannelOpen(false)
							}

							channel.onmessage = (event) => {
								if (typeof event.data === "string") {
									const data = JSON.parse(event.data)

									if (data.type === "FILE_START") {
										incomingFiles.current.set(data.payload.transferId, {
											transferId: data.payload.transferId,
											data: [],
											name: data.payload.name,
											size: data.payload.size,
											mimeType: data.payload.mimeType,
											totalChunks: data.payload.totalChunks,
											chunkSize: data.payload.chunkSize,
											receivedChunks: 0,
											startTime: performance.now(),
										})
										console.log(`📥 Receiving ${data.name}`)
										return
									}

									if (data.type === "FILE_END") {
										const transfer = incomingFiles.current.get(
											data.payload.transferId,
										)

										if (!transfer) {
											console.error("Received FILE_END without FILE_START")
											return
										}

										if (data.payload.transferId !== transfer.transferId) {
											console.error("Transfer ID mismatch")
											return
										}

										if (transfer.receivedChunks !== transfer.totalChunks) {
											console.error(
												`Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`,
											)
											return
										}

										const endTime = performance.now()

										const duration = endTime - transfer.startTime

										const seconds = (duration / 1000).toFixed(2)

										setReceivedMessages((prev) => [
											...prev,
											{
												id: data.payload.messageId ?? crypto.randomUUID(),
												text: `📥 ${transfer.name} received in ${seconds}s`,
												direction: "received",
											},
										])

										const blob = new Blob(transfer.data, {
											type: transfer.mimeType,
										})

										const url = URL.createObjectURL(blob)

										const link = document.createElement("a")

										link.href = url
										link.download = transfer.name

										link.click()

										URL.revokeObjectURL(url)

										console.log(`✅ Received ${transfer.name}`)

										incomingFiles.current.delete(data.payload.transferId)

										return
									}

									if (data.type === "CHAT_MESSAGE") {
										setReceivedMessages((prev) => [
											...prev,
											{
												id: data.payload.messageId ?? crypto.randomUUID(),
												text: data.payload.text,
												direction: "received",
											},
										])

										return
									}

									console.log("Unknown DataChannel message:", data)

									return

									return
								}

								if (event.data instanceof ArrayBuffer) {
									console.log("📦 Binary chunk received")

									if (incomingFiles.current.size === 0) {
										console.error(
											"Received chunk but no active transfer exists",
										)
										return
									}

									if (incomingFiles.current.size > 1) {
										console.error("Multiple active transfers detected")
										return
									}

									const transfer = incomingFiles.current.values().next().value

									if (!transfer) {
										return
									}

									transfer.data.push(event.data)
									transfer.receivedChunks++

									console.log(
										`📥 Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`,
									)
								}
							}
						}
					}

					break
				}

				case MessageType.OFFER: {
					console.log("OFFER CASE RAN")

					await setRemoteOffer(peerREF.current!, data.payload.offer)

					console.log("Offer received")

					await processPendingCandidates()

					const answer = await createAnswer(peerREF.current!)

					socket.current?.send(
						JSON.stringify({
							type: MessageType.ANSWER,

							payload: {
								targetId: peerId.current,
								answer,
							},
						}),
					)

					console.log("Answer sent")

					break
				}

				case MessageType.ANSWER: {
					console.log("ANSWER CASE RAN")
					await setRemoteAnswer(peerREF.current!, data.payload.answer)

					console.log(data.payload.answer)

					processPendingCandidates()

					break
				}

				case MessageType.ICE_CANDIDATE: {
					console.log("ICE_CANDIDATE CASE RAN")

					const candidate = data.payload.candidate

					if (!peerREF.current) {
						return
					}

					if (peerREF.current?.remoteDescription) {
						// If we already know the remote side, add it immediately
						await addIceCandidate(peerREF.current, candidate)
					} else {
						// If not, put it in the waiting room
						pendingCandidates.current.push(candidate)
						console.log(
							"⏳ ICE candidate queued - remoteDescription not set yet",
						)
					}
					break
				}

				case MessageType.ROOM_CREATED: {
					console.log("ROOM_CREATED CASE RAN")

					const code = data.payload.roomCode
					console.log("Room created:", code)

					createRoomState(code)

					setDisplayRoomCode(code)
					setRoomCode(code)
					setActiveRoomCode(code)
					break
				}

				case MessageType.ROOM_JOINED: {
					console.log("ROOM_JOINED CASE RAN")
					const code = data.payload.roomCode

					createRoomState(code, data.payload.devices)

					setRoomCode(code)
					setActiveRoomCode(code)


					playInitialRoomAnimation()

					for (const device of data.payload.devices) {
						if (device.deviceId !== getDeviceID() && device.online) {
							connectToRoomDevice(code, device)
						}
					}

					break
				}

				case MessageType.ROOM_DEVICES_UPDATED: {
					console.log("Room devices updated , CASE RAN")

					console.log("data.payload", data.payload)

					const roomCode = data.payload.roomCode
					const devices = data.payload.devices

					console.log("roomCode", roomCode)

					const room = roomsRef.current.get(roomCode)
					if (!room) {
						console.log("#################ROOM BREAKER###################")
						break
					}

					room.devices = devices



					const hasAnotherDevice = devices.some(
						(device: RoomDevice) =>
							device.deviceId !== getDeviceID() && device.online,
					)

					if (hasAnotherDevice) {
						playInitialRoomAnimation()
					}

					for (const device of devices) {
						if (device.online) {
							continue
						}

						const deviceId = device.deviceId

						// Close old peer
						const peer = room.peers.get(deviceId)

						if (peer) {
							peer.close()
							room.peers.delete(deviceId)

							console.log(`🧹 Removed stale peer → ${deviceId}`)
						}

						// Close old DataChannel
						const channel = room.dataChannels.get(deviceId)

						if (channel) {
							channel.close()
							room.dataChannels.delete(deviceId)

							console.log(`🧹 Removed stale DataChannel → ${deviceId}`)
						}

						// Remove pending ICE candidates
						room.pendingCandidates.delete(deviceId)

						// Remove peer timer
						const timer = room.peerTimers.get(deviceId)

						if (timer) {
							clearTimeout(timer)
							room.peerTimers.delete(deviceId)
						}

						// Remove connection status
						room.peerStatus = {
							...room.peerStatus,
						}

						delete room.peerStatus[deviceId]

						setRooms((prev) => ({
							...prev,
							[roomCode]: room,
						}))
					}
					break
				}

				case MessageType.ROOM_OFFER: {
					console.log("ROOM_OFFER CASE RAN")
					console.log(
						`📥 Room OFFER received from ${data.payload.senderDeviceId}`,
					)

					const roomCode = data.payload.roomCode
					const senderDeviceId = data.payload.senderDeviceId

					const room = roomsRef.current.get(roomCode)

					if (!room) {
						console.warn(`Room ${roomCode} not found`)
						break
					}

					// Don't create another peer if we already have one
					if (room.peers.has(senderDeviceId)) {
						console.log("Already have room peer:", senderDeviceId)
						break
					}

					const peer = createPeerConnection((candidate) => {
						if (!candidate) {
							return
						}

						socket.current?.send(
							JSON.stringify({
								type: MessageType.ROOM_ICE_CANDIDATE,
								payload: {
									roomCode,
									senderDeviceId: getDeviceID(),
									targetDeviceId: senderDeviceId,
									candidate,
								},
							}),
						)
					})

					room.peers.set(senderDeviceId, peer)

					peer.onconnectionstatechange = () => {
						console.log(`Room peer ${senderDeviceId}:`, peer.connectionState)

						room.peerStatus = {
							...room.peerStatus,
							[senderDeviceId]: peer.connectionState === "connected",
						}

						setRooms((prev) => ({
							...prev,
							[roomCode]: room,
						}))
					}

					peer.ondatachannel = (event) => {
						const channel = event.channel

						room.dataChannels.set(senderDeviceId, channel)

						channel.onopen = () => {
							console.log(`🟢 Room DataChannel OPEN → ${senderDeviceId}`)

							resetRoomPeerTimer(roomCode, senderDeviceId)

							const info = getLocalDeviceInfo()

							channel.send(createDeviceInfoMessage(info))

							console.log(`📱 Device info sent → ${senderDeviceId}`, info)
						}

						channel.onclose = () => {
							console.log(`🔴 Room DataChannel CLOSED → ${senderDeviceId}`)
						}

						channel.binaryType = "arraybuffer"

						channel.onmessage = (event) => {
							if (typeof event.data === "string") {
								const deviceInfoMessage = parseDeviceInfoMessage(event.data)

								if (deviceInfoMessage) {

									const room = roomsRef.current.get(roomCode)

									if (!room) return

									room.remoteDeviceInfo = {
										...room.remoteDeviceInfo,
										[senderDeviceId]: deviceInfo,
									}

									setRooms((prev) => ({
										...prev,
										[roomCode]: room,
									}))

									return
								}
							}

							handleIncomingFileMessage(roomCode, senderDeviceId, event)
						}
					}

					await setRemoteOffer(peer, data.payload.offer)

					console.log(`✅ Room OFFER applied from ${senderDeviceId}`)

					await processRoomPendingCandidates(roomCode, senderDeviceId, peer)

					const answer = await createAnswer(peer)

					socket.current?.send(
						JSON.stringify({
							type: MessageType.ROOM_ANSWER,
							payload: {
								roomCode,
								senderDeviceId: getDeviceID(),
								targetDeviceId: data.payload.senderDeviceId,
								answer,
							},
						}),
					)

					console.log("📤 Room ANSWER sent →", data.payload.senderDeviceId)

					break
				}

				case MessageType.ROOM_ANSWER: {
					console.log("ROOM_ANSWER CASE RAN")

					const roomCode = data.payload.roomCode

					const deviceId = data.payload.senderDeviceId

					const room = roomsRef.current.get(roomCode)

					if (!room) break

					const peer = room.peers.get(deviceId)

					if (!peer) {
						console.log("Room peer not found for answer:", deviceId)
						break
					}

					await setRemoteAnswer(peer, data.payload.answer)

					console.log("✅ Room ANSWER applied from", deviceId)

					// Apply ICE candidates that arrived before the answer
					await processRoomPendingCandidates(roomCode, deviceId, peer)

					break
				}

				case MessageType.ROOM_ICE_CANDIDATE: {
					const roomCode = data.payload.roomCode

					console.log("ROOM-ICE-CANDIDATE CASE RAN")
					const senderDeviceId = data.payload.senderDeviceId

					const candidate = data.payload.candidate

					const room = roomsRef.current.get(roomCode)

					if (!room) break

					const peer = room.peers.get(senderDeviceId)

					// Peer doesn't exist yet
					if (!peer) {
						const existing = room.pendingCandidates.get(senderDeviceId) ?? []

						existing.push(candidate)

						room.pendingCandidates.set(senderDeviceId, existing)

						break
					}

					// Peer exists but remote description isn't ready yet
					if (!peer.remoteDescription) {
						const existing = room.pendingCandidates.get(senderDeviceId) ?? []

						existing.push(candidate)

						room.pendingCandidates.set(senderDeviceId, existing)

						break
					}

					// Everything is ready
					await addIceCandidate(peer, candidate)

					break
				}
				default: {
					// console.log("default csae message:", data.type);
				}
			}
		}

		// when soxket closes dothis
		socket.current.onclose = () => {
			setConnected(false)
		}
	}

	const sendDataChannelMessage = () => {
		if (!dataChannel.current) {
			return
		}

		if (dataChannel.current.readyState !== "open") {
			return
		}

		if (!message.trim()) {
			return
		}

		const payload = JSON.stringify({
			type: "CHAT_MESSAGE",
			payload: message,
		})

		dataChannel.current.send(payload)

		setReceivedMessages((prev) => [
			...prev,
			{
				id: crypto.randomUUID(),
				text: `You: ${message}`,
				direction: "received",
			},
		])

		setMessage("")
	}

	const createSession = () => {
		socket.current?.send(
			JSON.stringify({
				type: MessageType.CREATE_SESSION,
				payload: {},
			}),
		)
	}

	// function for sending message to server to join session created by other user
	const joinSession = () => {
		socket.current?.send(
			JSON.stringify({
				type: MessageType.JOIN_SESSION,
				payload: {
					code: sessionCode,
				},
			}),
		)
	}

	const processPendingCandidates = async () => {
		if (peerREF.current) {
			for (const candidate of pendingCandidates.current) {
				await addIceCandidate(peerREF.current, candidate)
			}
			pendingCandidates.current = [] // Clear the queue
		}
	}

	const processRoomPendingCandidates = async (
		roomCode: string,
		deviceId: string,
		peer: RTCPeerConnection,
	) => {
		const room = roomsRef.current.get(roomCode)

		if (!room) {
			return
		}

		const candidates = room.pendingCandidates.get(deviceId)

		if (!candidates || candidates.length === 0) {
			return
		}

		for (const candidate of candidates) {
			await addIceCandidate(peer, candidate)
		}

		room.pendingCandidates.delete(deviceId)
	}

	const createRoom = () => {
		socket.current?.send(
			JSON.stringify({
				type: MessageType.CREATE_ROOM,
				payload: {},
			}),
		)
	}

	const joinRoom = () => {
		if (!roomCode.trim()) {
			return
		}

		socket.current?.send(
			JSON.stringify({
				type: MessageType.JOIN_ROOM,
				payload: {
					roomCode: roomCode.trim(),
				},
			}),
		)
	}

	const connectToRoomDevice = async (roomCode: string, device: RoomDevice) => {
		if (!device.online) {
			return
		}

		const room = roomsRef.current.get(roomCode)
		if (!room) return

		if (room.peers.has(device.deviceId)) {
			return
		}

		const peer = createPeerConnection((candidate) => {
			if (!candidate) {
				return
			}

			socket.current?.send(
				JSON.stringify({
					type: MessageType.ROOM_ICE_CANDIDATE,
					payload: {
						roomCode,
						senderDeviceId: getDeviceID(),
						targetDeviceId: device.deviceId,
						candidate,
					},
				}),
			)
		})

		room.peers.set(device.deviceId, peer)

		peer.onconnectionstatechange = () => {
			room.peerStatus = {
				...room.peerStatus,
				[device.deviceId]: peer.connectionState === "connected",
			}

			setRooms((prev) => ({
				...prev,
				[roomCode]: room,
			}))
		}

		const channel = peer.createDataChannel("bridge-room")

		channel.binaryType = "arraybuffer"

		channel.onopen = () => {
			resetRoomPeerTimer(roomCode, device.deviceId)

			const info = getLocalDeviceInfo()

			channel.send(createDeviceInfoMessage(info))
		}

		channel.onclose = () => {
			console.log(`🔴 Room DataChannel CLOSED → ${device.deviceName}`)
		}

		channel.binaryType = "arraybuffer"

		channel.onmessage = (event) => {

			if (typeof event.data === "string") {

				const deviceInfoMessage = parseDeviceInfoMessage(event.data)

				if (deviceInfoMessage) {

					const room = roomsRef.current.get(roomCode)

					if (!room) return

					room.remoteDeviceInfo = {
						...room.remoteDeviceInfo,
						[device.deviceId]: deviceInfoMessage.payload,
					}

					setRooms((prev) => ({
						...prev,
						[roomCode]: room,
					}))

					return
				}
			}

			handleIncomingFileMessage(roomCode, device.deviceId, event)
		}

		room.dataChannels.set(device.deviceId, channel)

		const offer = await createOffer(peer)

		socket.current?.send(
			JSON.stringify({
				type: MessageType.ROOM_OFFER,
				payload: {
					roomCode,
					senderDeviceId: getDeviceID(),
					targetDeviceId: device.deviceId,
					offer,
				},
			}),
		)
	}

	const ensureRoomConnection = async (roomCode: string, device: RoomDevice) => {
		// Device is offline — nothing to connect to
		if (!device.online) {
			return null
		}

		const room = roomsRef.current.get(roomCode)

		if (!room) {
			console.warn(`Room ${roomCode} not found`)
			return null
		}

		// Already connected
		const existingChannel = room.dataChannels.get(device.deviceId)

		if (existingChannel?.readyState === "open") {
			return existingChannel
		}

		// Connection is currently being established
		if (room.peers.has(device.deviceId)) {
			console.log(
				`⏳ Connection already being established → ${device.deviceName}`,
			)

			return null
		}

		// No connection exists → create one
		await connectToRoomDevice(roomCode, device)

		return null
	}

	const disconnectFromRoomDevice = (roomCode: string, deviceId: string) => {
		const room = roomsRef.current.get(roomCode)

		if (!room) {
			console.warn(`Room ${roomCode} not found`)
			return null
		}

		const timer = room?.peerTimers.get(deviceId)

		if (timer) {
			clearTimeout(timer)
			room?.peerTimers.delete(deviceId)
		}

		const peer = room.peers.get(deviceId)

		if (peer) {
			peer.close()
			room.peers.delete(deviceId)
		}

		const channel = room.dataChannels.get(deviceId)

		if (channel) {
			channel.close()
			room.dataChannels.delete(deviceId)
		}

		room.pendingCandidates.delete(deviceId)

		room.peerStatus = {
			...room.peerStatus,
		}

		delete room.peerStatus[deviceId]

		setRooms((prev) => ({
			...prev,
			[roomCode]: room,
		}))
	}

	const resetRoomPeerTimer = (roomCode: string, deviceId: string) => {
		const room = roomsRef.current.get(roomCode)

		if (!room) {
			console.warn(`Room ${roomCode} not found`)
			return null
		}

		// Clear the old timer
		const oldTimer = room.peerTimers.get(deviceId)

		if (oldTimer) {
			clearTimeout(oldTimer)
		}

		// Start a fresh 5-minute timer
		const timer = setTimeout(
			() => {
				console.log(`⏰ Room peer inactive for 5 minutes → ${deviceId}`)

				disconnectFromRoomDevice(roomCode, deviceId)
			},
			5 * 60 * 1000,
		)

		room.peerTimers.set(deviceId, timer)
	}

	const sendFileToRoomDevice = async (
		roomCode: string,
		deviceId: string,
		file: File,
	) => {
		resetRoomPeerTimer(roomCode, deviceId)

		const room = roomsRef.current.get(roomCode)

		if (!room) {
			return
		}

		const channel = room.dataChannels.get(deviceId)

		if (!channel) {
			return
		}

		if (channel.readyState !== "open") {
			return
		}

		try {
			await sendFile(channel, file, {
				onProgress: (sentBytes, totalBytes) => {
					const percentage = Math.round((sentBytes / totalBytes) * 100)

					console.log(`📤 ${deviceId}: ${percentage}%`)
				},
			})

			console.log(`✅ File sent → ${deviceId}`)
		} catch (error) {
			console.error("❌ Room file transfer failed:", error)
		}
	}

	const sendRoomMessage = async (
		roomCode: string,
		device: RoomDevice,
		text: string,
	) => {
		if (!text.trim()) {
			return
		}

		const channel = await ensureRoomConnection(roomCode, device)

		if (!channel || channel.readyState !== "open") {
			console.log(
				`⏳ Waiting for connection before sending → ${device.deviceName}`,
			)
			return
		}

		// here we are resetting the timer for rtc connection to break
		resetRoomPeerTimer(roomCode, device.deviceId)

		// creating message id for text message
		const messageId = crypto.randomUUID()

		const messagePayload = JSON.stringify({
			type: "ROOM_CHAT_MESSAGE",
			payload: {
				messageId,
				senderDeviceId: getDeviceID(),
				senderDeviceName: myDeviceName,
				text: text.trim(),
			},
		})

		channel.send(messagePayload)

		console.log(`📤 Message sent → ${device.deviceName}: ${text}`)

		const room = roomsRef.current.get(roomCode)

		if (!room) {
			return;
		}

		// Add our own message immediately
		room.messages = [
			...room.messages,
			{
				id: messageId,
				senderDeviceId: getDeviceID(),
				senderDeviceName: myDeviceName ?? "Unknown device",
				text: text.trim(),
				direction: "sent",
			},
		]

		setRooms((prev) => ({
			...prev,
			[roomCode]: room,
		}))
	}

	const handleIncomingFileMessage = (
		roomCode: string,
		senderDeviceId: string,
		event: MessageEvent,
	) => {
		resetRoomPeerTimer(roomCode, senderDeviceId)
		// =========================
		// STRING MESSAGE
		// =========================

		let roomTransfers = roomIncomingFiles.current.get(roomCode)


		const room = roomsRef.current.get(roomCode)

		if (!room) {
			return;
		}

		if (!roomTransfers) {
			roomTransfers = new Map()
			roomIncomingFiles.current.set(roomCode, roomTransfers)
		}

		if (typeof event.data === "string") {
			const data = JSON.parse(event.data)

			if (data.type === "ROOM_CHAT_MESSAGE") {
				const senderDevice = room.devices.find(
					(device) => device.deviceId === senderDeviceId
				)
				room.messages = [
					...room.messages,
					{
						id: data.payload.messageId ?? crypto.randomUUID(),
						senderDeviceId,
						senderDeviceName:
							data.payload.senderDeviceName ??
							senderDevice?.deviceName ??
							"Unknown device",
						text: data.payload.text,
						direction: "received",
					},
				]

				setRooms((prev) => ({
					...prev,
					[roomCode]: room,
				}))

				return
			}

			// -------------------------
			// FILE START
			// -------------------------

			if (data.type === "FILE_START") {
				const transferId = data.payload.transferId

				roomTransfers.set(senderDeviceId, {
					transferId,
					data: [],
					name: data.payload.name,
					size: data.payload.size,
					mimeType: data.payload.mimeType,
					totalChunks: data.payload.totalChunks,
					chunkSize: data.payload.chunkSize,
					receivedChunks: 0,
					startTime: performance.now(),
				})

				console.log(`📥 Receiving ${data.payload.name} from ${senderDeviceId}`)

				return
			}

			// -------------------------
			// FILE END
			// -------------------------

			if (data.type === "FILE_END") {
				const roomTransfers = roomIncomingFiles.current.get(roomCode)

				if (!roomTransfers) {
					console.error("Received FILE_END for unknown room")
					return
				}

				const transfer = roomTransfers.get(senderDeviceId)

				if (!transfer) {
					console.error("Received FILE_END without FILE_START")
					return
				}

				if (transfer.receivedChunks !== transfer.totalChunks) {
					console.error(
						`Missing chunks: ${transfer.receivedChunks}/${transfer.totalChunks}`,
					)
					return
				}

				const endTime = performance.now()

				const seconds = ((endTime - transfer.startTime) / 1000).toFixed(2)

				const blob = new Blob(transfer.data, {
					type: transfer.mimeType,
				})

				const url = URL.createObjectURL(blob)

				const link = document.createElement("a")

				link.href = url
				link.download = transfer.name

				link.click()

				URL.revokeObjectURL(url)

				console.log(`✅ Received ${transfer.name} in ${seconds}s`)

				setReceivedMessages((prev) => [
					...prev,
					{
						id: data.payload.messageId ?? crypto.randomUUID(),
						text: `📥 ${transfer.name} received in ${seconds}s`,
						direction: "received",
					},
				])

				// IMPORTANT:
				// Remove ONLY this transfer.
				roomTransfers.delete(senderDeviceId)

				if (roomTransfers.size === 0) {
					roomIncomingFiles.current.delete(roomCode)
				}

				return
			}

			if (data.type === "CHAT_MESSAGE") {
				setReceivedMessages((prev) => [
					...prev,
					{
						id: data.payload.messageId ?? crypto.randomUUID(),
						text: data.payload.text,
						direction: "received",
					},
				])

				return
			}

			return
		}

		// =========================
		// BINARY CHUNK
		// =========================

		if (event.data instanceof ArrayBuffer) {
			console.log(`📦 Binary chunk received from ${senderDeviceId}`)
			const roomTransfers = roomIncomingFiles.current.get(roomCode)

			if (!roomTransfers) {
				console.error(`No transfers found for room ${roomCode}`)
				return
			}

			const transfer = roomTransfers.get(senderDeviceId)

			if (!transfer) {
				console.error(
					`Received chunk from ${senderDeviceId}, but no active transfer exists`,
				)
				return
			}

			transfer.data.push(event.data)
			transfer.receivedChunks++

			console.log(
				`📥 ${senderDeviceId}: Chunk ${transfer.receivedChunks}/${transfer.totalChunks}`,
			)
		}
	}

	const handleDeviceSetup = () => {
		const name = deviceName.trim()

		if (!name) {
			return
		}
		setDeviceNameInLocalstorage(name)

		console.log(
			"inside hanlde device setup function that runs when name is entered",
		)

		connect()
	}

	const resetStorage = () => {
		localStorage.clear()
		sessionStorage.clear()
		window.location.reload()
	}

	const playInitialRoomAnimation = () => {
		if (hasInitialRoomAnimationPlayed.current) {
			return
		}

		hasInitialRoomAnimationPlayed.current = true

		roomJoinedAnimationTl.current?.play()
	}

	// // GSAP ANIMATIONS
	useGSAP(
		() => {
			if (!isSettled) {
				return
			}

			// run this animation if we need device setup
			if (isNewUser) {
				if (!heroRef.current || !introRef.current) return

				heroTL.current = gsap.timeline({
					paused: true,
				})

				afterIntroTL.current = gsap.timeline({
					paused: true,
				})

				gsap.set(introRef.current, {
					y: 30,
					opacity: 0,
					pointerEvents: "auto",
					// scale: 0.95
				})

				heroTL.current
					.to(heroRef.current, {
						scale: 0.5,
						y: "-40vh",
						duration: 1,
						delay: 0.5,
						ease: "power2.inOut",
					})
					.to(
						introRef.current,
						{
							opacity: 1,
							y: 0,
							scale: 1,
							duration: 0.5,
						},
						">-0.3",
					)

				afterIntroTL.current
					.to(heroRef.current, {
						y: "-55vh",
						duration: 1,
					})
					.to(
						introRef.current,
						{
							opacity: 0,
							duration: 0.5,
							pointerEvents: "none",
						},
						"<",
					)
					.set("#logo", {
						x: -100,
					})
					.set("#navTabs", {
						y: -100,
					})
					.set("#roomIntroText", {
						y: -30,
						scale: 0.95,
					})
					.set("#roomBox", {
						y: 50,
						scale: 0.95,
					})
					.set("#roomWorkSpace", {
						pointerEvents: "auto",
					})
					.to(
						"#logo",
						{
							opacity: 1,
							duration: 0.5,
							x: 0,
						},
						"<",
					)
					.to(
						"#navTabs",
						{
							opacity: 1,
							y: 0,
							duration: 0.5,
						},
						"<",
					)
					.to(
						"#roomIntroText",
						{
							opacity: 1,
							scale: 1,
							y: 0,
							duration: 0.5,
						},
						"<",
					)
					.to(
						"#roomBox",
						{
							opacity: 1,
							y: 0,
							scale: 1,
							duration: 0.5,
						},
						">",
					)
					.to(
						"#roomSelectionText-1",
						{
							opacity: 1,
							// y: 0,
							// scale: 1,
							duration: 0.5,
						},
						">",
					)
			}

			// run tis animation when we do not need device setup
			if (!isNewUser) {
				console.log("refresh animation working")

				RefreshTL.current = gsap.timeline({
					paused: true,
					onStart: () => {
						console.log("refresh animation started ---------------------")
					},
					onComplete: () => {
						console.log("refresh animation complet #####################")
					},
				})

				RefreshTL.current
					.set("#logo", {
						x: -100,
					})
					.set("#navTabs", {
						y: -100,
					})
					.to(
						"#logo",
						{
							opacity: 1,
							duration: 0.5,
							x: 0,
						},
						"<",
					)
					.to(
						"#navTabs",
						{
							opacity: 1,
							y: 0,
							duration: 0.5,
						},
						"<",
					)
					.to(
						"#roomIntroText",
						{
							opacity: 1,
							scale: 1,
							y: 0,
							duration: 0.5,
						},
						"<",
					)
					.to(
						"#roomBox",
						{
							opacity: 1,
							y: 0,
							scale: 1,
							duration: 0.5,
						},
						">",
					)
					.set("#roomWorkSpace", {
						pointerEvents: "auto",
					})
					.to(
						"#roomSelectionText-1",
						{
							opacity: 1,
							// y: 0,
							// scale: 1,
							duration: 0.5,
						},
						">",
					)

				if (!heroRef.current) return

				heroTL.current = gsap.timeline({
					paused: true,
				})

				heroTL.current.to(heroRef.current, {
					scale: 0.5,
					opacity: 0,
					y: "-40vh",
					duration: 1,
					delay: 0.5,
					ease: "power2.inOut",
					onComplete: () => {
						if (RefreshTL.current) {
							console.log(
								"hero animation complete -----------------------------",
							)
							setIsHeroAnimationDone(true)
							RefreshTL.current?.play()
						}
					},
				})
			}
		},
		{
			scope: Container,
			dependencies: [isSettled, isNewUser],
		},
	)

	// this gsap runs the animation when first room is joined
	useGSAP(() => {
		roomJoinedAnimationTl.current = gsap.timeline({
			paused: true,
			onStart: () => {
				console.log("roomJoinedAnimationTl started ---------------------------")
			},
		})

		roomJoinedAnimationTl.current
			.to("#roomIntroText", {
				height: "0%",
				opacity: 0,
				duration: 0.5,
			})
			.to(
				"#roomBox",
				{
					height: "100%",
					width: "100%",
					duration: 0.5,
					maskImage: "linear-gradient(to bottom, black 100%, transparent 100%)",
				},
				"<",
			)
			.to(
				"#createRoomCard",
				{
					opacity: 0,
					duration: 0.5,
				},
				"<",
			)
			.to(
				"#roomCardText",
				{
					opacity: 0,
					duration: 0.5,
				},
				"<",
			)
			.to(
				"#joinRoomCard",
				{
					opacity: 0,
					duration: 0.5,
					onComplete: () => {
						console.log("needsDeviceSetup is setting false")
						setNeedsDeviceSetup(false)
					},
				},
				"<",
			)
			.to(
				"#DeviceGridList",
				{
					opacity: 1,
					duration: 0.5,
				},
				">",
			)
			.to(
				"#RoomMessages",
				{
					opacity: 1,
					duration: 0.5,
				},
				">",
			)
	})

	const createRoomButtonAnimation = () => {
		const tl = gsap.timeline()

		tl.set("#roomSelectionText-2", {
			scale: 0.7,
		})
			.to("#roomSelectionText-1", {
				yPercent: -100,
				opacity: 0,
				scale: 0.7,
				duration: 0.8,
				ease: "power1.out",
			})
			.to(
				"#roomSelectionText-2",
				{
					yPercent: -100,
					opacity: 1,
					scale: 1,
					duration: 0.8,
					ease: "power1.out",
				},
				"<",
			)
	}

	const handleStrokeComplete = () => {
		heroTL.current?.play()
	}

	const handleIntroSetupDone = () => {
		afterIntroTL.current?.play()
	}

	// this function fires when inside codeInput comp all six digs are typed
	const handleCodeComplete = (code: string) => {
		setRoomCode(code)
	}

// 	return (
// 		<div
// 			ref={Container}
// 			className="relative bg-[#010610] w-screen h-screen flex flex-  items-center overflow-hidden">
// 			<button
// 				className="absolute z-10000 bottom-0 right-0 bg-amber-600 "
// 				onClick={resetStorage}
// 				style={{
// 					padding: "8px 12px",
// 					borderRadius: "6px",
// 					border: "1px solid #ccc",
// 					cursor: "pointer",
// 				}}>
// 				Reset App Data
// 			</button>

// 			{/* hero text */}
// 			{!isHeroAnimationDone && (
// 				<div
// 					ref={heroRef}
// 					id="heroText"
// 					className="absolute z-500 inset-0 neon-font">
// 					<StrokeText
// 						className="tile absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-2/3 "
// 						text="Escape-Bridge"
// 						strokeColor="#A78BFA"
// 						fillColor="#F8FAFC"
// 						strokeWidth={1}
// 						drawDuration={1}
// 						fillDelay={0}
// 						stagger={0.05}
// 						ease="power2.out"
// 						trigger="mount"
// 						fillMode="wipe"
// 						fontSize={130}
// 						fontWeight={800}
// 						letterSpacing={-4}
// 						reverse={false}
// 						onComplete={handleStrokeComplete}
// 					/>
// 				</div>
// 			)}

// 			{/* intro para */}
// 			{needsDeviceSetup && (
// 				<div
// 					ref={introRef}
// 					id="introPara"
// 					className="absolute z-500 h-full w-full flex items-center justify-center opacity-0 pointer-events-none">
// 					<Intro
// 						deviceName={deviceName}
// 						setDeviceNameState={setDeviceNameState}
// 						handleDeviceSetup={handleDeviceSetup}
// 						handleIntroSetupDone={handleIntroSetupDone}
// 					/>
// 				</div>
// 			)}

// 			{/* Main site things */}
// 			<div className="w-full h-full flex flex-col  ">
// 				{/* ROP BAR */}
// 				<div className=" w-full h-[10%] grid grid-cols-3  ">
// 					{/* Side logo */}

// 					{/* Desktop / larger screens */}
// 					<h1
// 						id="logo"
// 						className="hidden md:block neon-font font-extrabold text-xl tracking-wide justify-self-start self-center h-fit ml-[2vw] opacity-0">
// 						Escape-Bridge
// 					</h1>

// 					{/* Top Navigation Tabs */}
// 					<div
// 						id="navTabs"
// 						className=" col-span-3 md:col-span-1 justify-self-center self-center opacity-0 ">
// 						<div className="flex rounded-[14px] border border-slate-800 bg-slate-900 p-1 h-10 w-fit">
// 							<button
// 								onClick={() => setActiveTab("room")}
// 								className={`cursor-pointer rounded-[10px] border-none px-7 py-2.5text-sm font-semibold transition-all duration-200 ease-in-out${activeTab === "room"
// 									? "bg-slate-800 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
// 									: "bg-transparent text-slate-500 shadow-none"
// 									}`}>
// 								Room
// 							</button>

// 							<button
// 								onClick={() => setActiveTab("p2p")}
// 								className={`cursor-pointer rounded-[10px] border-none px-7 py-2.5        text-sm font-semibold transition-all duration-200 ease-in-out        ${activeTab === "p2p"
// 									? "bg-slate-800 text-sky-400 shadow-[0_4px_12px_rgba(0,0,0,0.2)]"
// 									: "bg-transparent text-slate-500 shadow-none"
// 									}`}>
// 								P2P
// 							</button>
// 						</div>
// 					</div>

// 					{/* navbar create and join room buttons  */}
// 					<div className="h-full w-full flex gap-4 justify-center items-center">
// 						<div className="h-full w-full flex gap-4 justify-center items-center">
// 							{/* CREATE ROOM CONTAINER */}
// 							<div className="relative flex w-1/3 h-1/2 items-center justify-center">
// 								{/* Absolute Room Code display (Fades in/out from left) */}
// 								<div
// 									className={`absolute right-full mr-4 h-full flex items-center rounded-[11px] bg-[#0b1f2a] border border-[#3ee8ff]/30 overflow-hidden transition-all duration-300 ease-out ${roomCode
// 										? "opacity-100 translate-x-0 pointer-events-auto"
// 										: "opacity-0 -translate-x-4 pointer-events-none"
// 										}`}>
// 									<button
// 										onClick={() =>
// 											roomCode && navigator.clipboard.writeText(roomCode)
// 										}
// 										className="h-full px-4 flex items-center justify-center text-[#3ee8ff] hover:bg-[#3ee8ff]/10 transition"
// 										title="Copy room code">
// 										<svg
// 											width="18"
// 											height="18"
// 											viewBox="0 0 24 24"
// 											fill="none"
// 											stroke="currentColor"
// 											strokeWidth="2"
// 											strokeLinecap="round"
// 											strokeLinejoin="round">
// 											<rect x="9" y="9" width="13" height="13" rx="2" />
// 											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
// 										</svg>
// 									</button>

// 									<div className="h-3/5 w-px bg-[#3ee8ff]/20" />

// 									<span className="px-5 text-[15px] font-semibold tracking-[0.2em] text-white whitespace-nowrap">
// 										{roomCode}
// 									</span>
// 								</div>

// 								{/* Create Room Button */}
// 								<button
// 									onClick={() => {
// 										if (roomCode) {
// 											setRoomCode("") // Clears active state when ESC/close is clicked
// 										} else {
// 											createRoom()
// 											createRoomButtonAnimation()
// 										}
// 									}}
// 									className="flex w-full h-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">
// 									{roomCode ? (
// 										<span className="text-[13px] font-medium tracking-wide text-[#02141c]/80">
// 											Press{" "}
// 											<kbd className="rounded bg-[#02141c]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#02141c]">
// 												ESC
// 											</kbd>{" "}
// 											to close
// 										</span>
// 									) : (
// 										<>
// 											<span className="text-[20px] leading-none">+</span>
// 											Create room
// 										</>
// 									)}
// 								</button>
// 							</div>

// 							{/* JOIN ROOM CONTAINER */}
// 							<div className="relative w-1/3 h-1/2 flex flex-col items-center justify-center">
// 								{/* Join Room Button */}
// 								<button
// 									ref={joinButtonRef}
// 									onClick={() => {
// 										setShowJoinInput((prev) => !prev)
// 									}}
// 									className="flex w-full h-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">
// 									{showJoinInput ? (
// 										<span className="text-[13px] font-medium tracking-wide text-[#02141c]/80">
// 											Press{" "}
// 											<kbd className="rounded bg-[#02141c]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#02141c]">
// 												ESC
// 											</kbd>{" "}
// 											to close
// 										</span>
// 									) : (
// 										<>
// 											<span className="text-[18px]">→</span>
// 											Join room
// 										</>
// 									)}
// 								</button>

// 								{/* Join Room Input (Fades in/out downwards) */}
// 								<div
// 									className={`absolute top-[115%] left-0 w-full flex items-center gap-2 rounded-[11px] border border-[#3ee8ff]/30 bg-[#0b1f2a] p-2 shadow-[0_8px_26px_-8px_rgba(62,232,255,0.3)] transition-all duration-300 ease-out z-10 ${showJoinInput
// 										? "opacity-100 translate-y-0 pointer-events-auto"
// 										: "opacity-0 -translate-y-2 pointer-events-none"
// 										}`}>
// 									<input
// 										ref={joinDialogueInputRef}
// 										type="text"
// 										inputMode="numeric"
// 										maxLength={6}
// 										placeholder="Enter room code"
// 										value={joinDialogueCode}
// 										onChange={(e) => {
// 											const value = e.target.value.replace(/\D/g, "")
// 											setJoinDialogueCode(value)
// 											setRoomCode(value)
// 										}}
// 										onKeyDown={(e) => {
// 											if (e.key === "Enter" && joinDialogueCode.length === 6) {
// 												joinRoom()
// 											}
// 										}}
// 										className="min-w-0 flex-1 bg-transparent px-3 py-2 text-center text-[14px] font-semibold tracking-[0.25em] text-white outline-none placeholder:tracking-normal placeholder:text-white/30"
// 									/>

// 									<button
// 										onClick={() => {
// 											if (joinDialogueCode.length === 6) {
// 												joinRoom()
// 											}
// 										}}
// 										className="rounded-[8px] bg-[#3ee8ff] px-4 py-2 text-[13px] font-semibold text-[#02141c] transition hover:bg-[#7fd8ff] active:scale-[0.98]">
// 										Join
// 									</button>
// 								</div>
// 							</div>
// 						</div>
// 					</div>
// 				</div>

// 				{/* BOTTOM SECTION */}
// 				<div className="  mx-auto mb-6  w-[80vw] h-[90%] bg font-['Inter',system-ui,-apple-system,sans-serif] text-slate-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ">
// 					{/* Main Workspace */}
// 					<div className="h-full ">
// 						{activeTab === "room" && (
// 							<div
// 								id="roomWorkSpace"
// 								className=" relative z-0  flex flex-col h-full justify-center items-center pointer-events-none ">
// 								{needsDeviceSetup && (
// 									<span
// 										id="roomIntroText"
// 										className="absolute inset-0  opacity-0 h-1/6 flex justify-center items-center text-slate-300 text-3xl">
// 										If u want one time setup and seemeless connectivity , u are
// 										at right place{" "}
// 									</span>
// 								)}

// 								<div
// 									id="roomBox"
// 									className="absolute bottom-0 bg-amber-50  opacity-0 w-4/5 h-5/6  border-4 rounded-4xl  shadow-2xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
// 									{/* this is the create and join room card  */}
// 									{needsDeviceSetup && (
// 										<>
// 											<div className="grid grid-cols-2 gap-5 p-7">
// 												{/* CREATE ROOM */}
// 												<div
// 													id="createRoomCard"
// 													className="relative overflow-hidden rounded-[20px] border border-[rgba(140,180,220,0.12)] bg-gradient-to-b from-[#101a26] to-[#13202f] p-7">
// 													{/* subtle glow */}
// 													<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(320px_160px_at_15%_-10%,rgba(62,232,255,0.08),transparent_70%)]" />

// 													<div className="relative">
// 														{/* label */}
// 														<div className="mb-[18px] flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.14em] text-[#5c6c82]">
// 															<span className="h-[6px] w-[6px] rounded-full bg-[#3ee8ff] shadow-[0_0_6px_#3ee8ff]" />
// 															New session
// 														</div>

// 														{/* heading */}
// 														<h2 className="mb-2 font-['Sora'] text-[19px] font-semibold text-[#eaf2fb]">
// 															Create a room
// 														</h2>

// 														{/* description */}
// 														<p className="mb-6 text-[13.5px] leading-[1.55] text-[#93a5bd]">
// 															Generates a one-time 6-digit code. Share it with
// 															any device you want to bridge into this room.
// 														</p>

// 														{/* create button */}
// 														<button
// 															onClick={() => {
// 																createRoom()
// 																createRoomButtonAnimation()
// 															}}
// 															className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">
// 															<span className="text-[20px] leading-none">
// 																+
// 															</span>
// 															Create room
// 														</button>

// 														{/* generated code */}
// 														<div className="mt-[22px]">
// 															<div className="mb-4 flex flex-wrap gap-2">
// 																{[0, 1, 2, 3, 4, 5].map((index) => (
// 																	<div
// 																		key={index}
// 																		className={`min-w-[54px] min-h-[64px] rounded-[10px] border border-[rgba(140,200,255,0.24)] bg-[rgba(62,232,255,0.06)] px-[14px] py-[10px] text-center font-mono text-[30px] font-semibold tracking-[0.02em] text-[#eaf2fb] [text-shadow:0_0_20px_rgba(62,232,255,0.35)] ${index === 3 ? "ml-1" : ""
// 																			}`}>
// 																		{displayRoomCode?.[index] || ""}
// 																	</div>
// 																))}
// 															</div>

// 															{/* copy/share */}
// 															<div className="flex gap-[10px]">
// 																<button
// 																	onClick={() => {
// 																		navigator.clipboard.writeText(
// 																			displayRoomCode,
// 																		)
// 																	}}
// 																	className="flex w-auto items-center justify-center gap-2 rounded-[9px] border border-[rgba(140,180,220,0.12)] bg-[rgba(255,255,255,0.03)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[#eaf2fb] transition hover:border-[rgba(140,200,255,0.24)] hover:bg-[rgba(255,255,255,0.06)]">
// 																	Copy code
// 																</button>

// 																<button className="flex w-auto items-center justify-center gap-2 rounded-[9px] border border-[rgba(140,180,220,0.12)] bg-[rgba(255,255,255,0.03)] px-[14px] py-[9px] text-[12.5px] font-semibold text-[#eaf2fb] transition hover:border-[rgba(140,200,255,0.24)] hover:bg-[rgba(255,255,255,0.06)]">
// 																	Share
// 																</button>
// 															</div>
// 														</div>
// 													</div>
// 												</div>

// 												{/* JOIN ROOM */}
// 												<div
// 													id="joinRoomCard"
// 													className="relative overflow-hidden rounded-[20px] border border-[rgba(140,180,220,0.12)] bg-gradient-to-b from-[#101a26] to-[#13202f] p-7">
// 													{/* subtle glow */}
// 													<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(320px_160px_at_15%_-10%,rgba(62,232,255,0.08),transparent_70%)]" />

// 													<div className="relative">
// 														{/* label */}
// 														<div className="mb-[18px] flex items-center gap-[9px] font-mono text-[11px] uppercase tracking-[0.14em] text-[#5c6c82]">
// 															<span className="h-[6px] w-[6px] rounded-full bg-[#3ee8ff] shadow-[0_0_6px_#3ee8ff]" />
// 															Join session
// 														</div>

// 														{/* heading */}
// 														<h2 className="mb-2 font-['Sora'] text-[19px] font-semibold text-[#eaf2fb]">
// 															Join a room
// 														</h2>

// 														{/* description */}
// 														<p className="mb-6 text-[13.5px] leading-[1.55] text-[#93a5bd]">
// 															Enter the 6-digit code shown on the other device
// 															to bridge into their room.
// 														</p>

// 														{/* OTP */}
// 														<div className="mb-5 flex gap-2">
// 															<CodeInput
// 																onComplete={handleCodeComplete}
// 															// nextFocusRef={joinButtonRef}
// 															/>
// 														</div>

// 														{/* join */}
// 														<button
// 															ref={joinButtonRef}
// 															onClick={joinRoom}
// 															className="flex w-full items-center justify-center gap-2 rounded-[11px] bg-gradient-to-br from-[#3ee8ff] via-[#7fd8ff] to-[#4f8cff] px-5 py-[13px] text-[14px] font-semibold text-[#02141c] shadow-[0_8px_26px_-8px_rgba(62,232,255,0.55)] transition hover:shadow-[0_10px_32px_-6px_rgba(62,232,255,0.7)] active:scale-[0.98]">
// 															<span className="text-[18px]">→</span>
// 															Join room
// 														</button>

// 														{/* helper */}
// 														<p className="mt-3 text-[12.5px] text-[#5c6c82]">
// 															Codes are 6 digits and expire when the room
// 															closes.
// 														</p>
// 													</div>
// 												</div>
// 											</div>

// 											<div id="roomCardText" className="mt-16">
// 												<span
// 													id="roomSelectionText-1"
// 													className="opacity-0 h-fit bg-gray-700 flex justify-center items-center text-slate-300 text-3xl">
// 													Just create a room, copy the code and paste it on the
// 													other device
// 												</span>
// 												<span
// 													id="roomSelectionText-2"
// 													className="opacity-0 h-fit flex justify-center items-center text-slate-300 text-3xl">
// 													Congrats!! U just created a room <br />
// 													Now paste the code on other device and witness the
// 													happening
// 												</span>
// 											</div>
// 										</>
// 									)}

// 									{/* Room Switcher */}
// 									<div className=" flex items-center w-fit gap-1.5 rounded-[12px] border border-[#3ee8ff]/20 bg-[#0b1f2a]/80 p-1.5 backdrop-blur-md shadow-[0_8px_24px_-6px_rgba(0,0,0,0.5)]">
// 										<div className="px-2 font-mono text-[10px] uppercase tracking-wider text-[#5c6c82] border-r border-[#3ee8ff]/15 mr-1 select-none">
// 											Active Rooms
// 										</div>
// 										{Object.keys(rooms).map((code) => {
// 											const isActive = activeRoomCode === code
// 											return (
// 												<button
// 													key={code}
// 													onClick={() => setActiveRoomCode(code)}
// 													className={`relative flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-xs font-mono font-semibold tracking-wider transition-all duration-200 cursor-pointer ${isActive
// 														? "bg-gradient-to-r from-[#3ee8ff] to-[#7fd8ff] text-[#02141c] shadow-[0_0_12px_rgba(62,232,255,0.4)]"
// 														: "bg-transparent text-slate-400 hover:bg-[#3ee8ff]/10 hover:text-[#3ee8ff]"
// 														}`}>
// 													<span
// 														className={`h-1.5 w-1.5 rounded-full ${isActive
// 															? "bg-[#02141c] shadow-[0_0_4px_#02141c]"
// 															: "bg-[#3ee8ff]/40"
// 															}`}
// 													/>
// 													{code}
// 												</button>
// 											)
// 										})}
// 									</div>

// 									{/* Devices Grid / List */}
// 									<div
// 										id="DeviceGridList"
// 										className="h-1/2 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 p-5 opacity-0">
// 										{activeRoomDevices.length === 0 && (
// 											<div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900 px-5 py-10 text-center text-sm text-slate-500">
// 												No devices connected to this room yet.
// 											</div>
// 										)}

// 										{activeRoomDevices
// 											.filter((device) => device.deviceId !== getDeviceID())
// 											.map((device) => {
// 												const isCurrentDevice =
// 													device.deviceId === getDeviceID()
// 												const isConnected =
// 													activeRoom?.peerStatus[device.deviceId] ?? false
// 												const selectedFile =
// 													activeRoom?.selectedFiles[device.deviceId] ?? null
// 												const isExpanded = expandedDevice === device.deviceId

// 												return (
// 													<div
// 														key={device.deviceId}
// 														className={`
//     w-full max-w-xl overflow-hidden rounded-2xl
//     border bg-slate-900
//     transition-all duration-300
//     ${isExpanded ? "h-56" : "h-16"}
//     ${device.online
// 																? isConnected
// 																	? "border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.05)]"
// 																	: "border-slate-800"
// 																: "cursor-not-allowed opacity-60 border-slate-800"
// 															}
//   `}
// 														onMouseEnter={() => {
// 															if (device.online) {
// 																setExpandedDevice(device.deviceId)
// 															}
// 														}}
// 														onMouseLeave={() => {
// 															if (device.online) {
// 																setExpandedDevice(null)
// 															}
// 														}}
// 														onClick={() => {
// 															if (device.online) {
// 																setExpandedDevice((prev) =>
// 																	prev === device.deviceId
// 																		? null
// 																		: device.deviceId,
// 																)
// 															}
// 														}}>
// 														{/* ================= COLLAPSED HEADER ================= */}

// 														<div className="flex h-16 items-center gap-3 px-4">
// 															{/* Device icon */}
// 															<DeviceIcon
// 																deviceType={
// 																	activeRoom?.remoteDeviceInfo[device.deviceId]?.deviceType ?? "unknown"
// 																}
// 																size={28}
// 															/>

// 															{/* Online status */}
// 															<span
// 																className={` h-2 w-2 shrink-0 rounded-full ${device.online ? "bg-emerald-500" : "bg-rose-500"}`}
// 															/>

// 															{/* Device name + badges */}
// 															<div className="min-w-0 shrink-0">
// 																<h3 className="m-0 truncate text-sm font-bold text-slate-50">
// 																	{device.deviceName}
// 																</h3>

// 																<div className="mt-0.5 flex gap-1">
// 																	{device.isHost && (
// 																		<span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
// 																			HOST
// 																		</span>
// 																	)}

// 																	{isCurrentDevice && (
// 																		<span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[9px] font-bold text-sky-400">
// 																			YOU
// 																		</span>
// 																	)}
// 																</div>
// 															</div>

// 															{/* Message input */}
// 															<input
// 																disabled={!device.online}
// 																placeholder={`Message to ${device.deviceName}...`}
// 																value={activeRoom?.deviceMessages?.[device.deviceId] || ""}
// 																onFocus={() => {
// 																	if (!isCurrentDevice && device.online) {
// 																		const room = roomsRef.current.get(roomCode)
// 																		const channel = room?.dataChannels.get(
// 																			device.deviceId,
// 																		)

// 																		if (channel?.readyState === "open") {
// 																			resetRoomPeerTimer(
// 																				roomCode,
// 																				device.deviceId,
// 																			)
// 																		}

// 																		ensureRoomConnection(roomCode, device)
// 																	}
// 																}}
// 																onChange={(e) => {
// 																	const value = e.target.value

// 																	if (!activeRoomCode) return

// 																	const room = roomsRef.current.get(activeRoomCode)
// 																	if (!room) return

// 																	room.deviceMessages = {
// 																		...room.deviceMessages,
// 																		[device.deviceId]: value,
// 																	}

// 																	setRooms((prev) => ({
// 																		...prev,
// 																		[activeRoomCode]: room,
// 																	}))
// 																}}
// 																onKeyDown={(e) => {
// 																	if (e.key === "Enter") {
// 																		const text =
// 																			activeRoom?.deviceMessages?.[device.deviceId]

// 																		if (text && text.trim()) {
// 																			sendRoomMessage(roomCode, device, text)

// 																			if (!activeRoomCode) return

// 																			const room = roomsRef.current.get(activeRoomCode)
// 																			if (!room) return

// 																			room.deviceMessages = {
// 																				...room.deviceMessages,
// 																				[device.deviceId]: "",
// 																			}

// 																			setRooms((prev) => ({
// 																				...prev,
// 																				[activeRoomCode]: room,
// 																			}))
// 																		}
// 																	}
// 																}}
// 																onClick={(e) => e.stopPropagation()}
// 																className={` min-w-0 flex-1 rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs outline-none ${device.online
// 																	? "text-slate-50 placeholder:text-slate-600"
// 																	: "cursor-not-allowed text-slate-600"
// 																	}
//   `}
// 															/>

// 															{/* Connection button */}
// 															{/* {!isCurrentDevice &&
// 																device.online &&
// 																(isConnected ? (
// 																	<button
// 																		onClick={(e) => {
// 																			e.stopPropagation()

// 																			disconnectFromRoomDevice(
// 																				roomCode,
// 																				device.deviceId,
// 																			)
// 																		}}
// 																		className="
//                   shrink-0 rounded-lg
//                   border border-rose-500/30
//                   bg-rose-500/10
//                   px-3 py-2
//                   text-xs font-semibold
//                   text-rose-500
//                 ">
// 																		Disconnect
// 																	</button>
// 																) : (
// 																	<button
// 																		onClick={(e) => {
// 																			e.stopPropagation()

// 																			connectToRoomDevice(roomCode, device)
// 																		}}
// 																		className="
//                   shrink-0 rounded-lg
//                   bg-blue-600
//                   px-3 py-2
//                   text-xs font-semibold
//                   text-white
//                 ">
// 																		Connect
// 																	</button>
// 																))} */}

// 															{/* Paste */}
// 															<button
// 																disabled={!device.online}
// 																onClick={async (e) => {
// 																	e.stopPropagation()

// 																	const text =
// 																		await navigator.clipboard.readText()

// 																	if (!activeRoomCode) return

// 																	const room = roomsRef.current.get(activeRoomCode)
// 																	if (!room) return

// 																	room.deviceMessages = {
// 																		...room.deviceMessages,
// 																		[device.deviceId]: text,
// 																	}

// 																	setRooms((prev) => ({
// 																		...prev,
// 																		[activeRoomCode]: room,
// 																	}))
// 																}}
// 																className={`
//     shrink-0 rounded-lg px-3 py-2 text-xs font-medium
//     ${device.online
// 																		? "text-slate-400 hover:bg-white/10 hover:text-white"
// 																		: "cursor-not-allowed text-slate-700"
// 																	}
//   `}>
// 																Paste
// 															</button>
// 														</div>

// 														{/* ================= EXPANDED FILE AREA ================= */}

// 														<div
// 															className={`
//             flex flex-col gap-3 px-4 pb-4
//             transition-all duration-300
//             ${isExpanded
// 																	? "translate-y-0 opacity-100"
// 																	: "pointer-events-none -translate-y-2 opacity-0"
// 																}
//           `}>
// 															{/* File picker */}

// 															<input
// 																id={`file-${device.deviceId}`}
// 																type="file"
// 																className="hidden"
// 																onChange={(e) => {
// 																	const file = e.target.files?.[0] ?? null

// 																	if (!activeRoomCode) return

// 																	const room =
// 																		roomsRef.current.get(activeRoomCode)
// 																	if (!room) return

// 																	room.selectedFiles = {
// 																		...room.selectedFiles,
// 																		[device.deviceId]: file,
// 																	}

// 																	setRooms((prev) => ({
// 																		...prev,
// 																		[activeRoomCode]: room,
// 																	}))

// 																	// Allow selecting the same file again later
// 																	e.target.value = ""
// 																}}
// 															/>

// 															<label
// 																htmlFor={`file-${device.deviceId}`}
// 																onClick={(e) => e.stopPropagation()}
// 																className={`
//               block w-full
//               cursor-pointer
//               overflow-hidden
//               text-ellipsis
//               whitespace-nowrap
//               rounded-lg
//               border border-slate-800
//               bg-[#090d16]
//               px-3 py-2
//               text-center
//               text-xs
//               ${selectedFile ? "text-slate-50" : "text-slate-500"}
//             `}>
// 																{selectedFile
// 																	? selectedFile.name
// 																	: "Choose file"}
// 															</label>

// 															{/* Send file */}

// 															{!isCurrentDevice &&
// 																device.online &&
// 																isConnected && (
// 																	<button
// 																		onClick={(e) => {
// 																			e.stopPropagation()

// 																			if (!selectedFile) {
// 																				console.log(
// 																					"No file selected for",
// 																					device.deviceId,
// 																				)
// 																				return
// 																			}

// 																			sendFileToRoomDevice(
// 																				roomCode,
// 																				device.deviceId,
// 																				selectedFile,
// 																			)
// 																		}}
// 																		disabled={!selectedFile}
// 																		className={`
//                   w-full rounded-lg
//                   p-2
//                   text-xs font-semibold
//                   transition-all duration-200
//                   ${selectedFile
// 																				? "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-500"
// 																				: "cursor-not-allowed bg-slate-800 text-slate-500"
// 																			}
//                 `}>
// 																		Send Selected File
// 																	</button>
// 																)}
// 														</div>
// 													</div>
// 												)
// 											})}
// 									</div>

// 									{/* Room Messages */}
// 									<div
// 										id="RoomMessages"
// 										className="flex h-1/2 flex-col rounded-3xl border border-slate-800/80 bg-[#080d16]/80 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.18)]">
// 										{/* Header */}
// 										<div className="mb-4 flex items-center justify-between">
// 											<div>
// 												<h3 className="text-sm font-semibold text-slate-100">
// 													Room Messages
// 												</h3>

// 												<p className="mt-1 text-[11px] text-slate-500">
// 													Messages from devices in this room
// 												</p>
// 											</div>

// 											<div className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[10px] font-medium text-slate-500">
// 												{activeRoom?.messages.length ?? 0}{" "}
// 												{(activeRoom?.messages.length ?? 0) === 1 ? "message" : "messages"}
// 											</div>
// 										</div>

// 										{/* Messages */}
// 										<div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
// 											{(activeRoom?.messages.length ?? 0) === 0 ? (
// 												<div className="flex flex-1 flex-col items-center justify-center text-center">
// 													<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-600">
// 														<svg
// 															viewBox="0 0 24 24"
// 															className="h-5 w-5"
// 															fill="none"
// 															stroke="currentColor"
// 															strokeWidth="1.7">
// 															<path
// 																strokeLinecap="round"
// 																strokeLinejoin="round"
// 																d="M8 10h8M8 14h5m7-2a8 8 0 11-15.3 3.3L3 21l5.7-1.7A8 8 0 0021 12z"
// 															/>
// 														</svg>
// 													</div>

// 													<p className="text-xs font-medium text-slate-500">
// 														No messages yet
// 													</p>

// 													<p className="mt-1 text-[11px] text-slate-700">
// 														Messages from connected devices will appear here
// 													</p>
// 												</div>
// 											) : (
// 												(activeRoom?.messages ?? []).map((msg) => {
// 													const isYou = msg.senderDeviceId === getDeviceID()

// 													return (
// 														<div
// 															key={`${msg.senderDeviceId}-${msg.text}-${(activeRoom?.messages ?? []).indexOf(msg)}`}
// 															className={`group flex w-full items-center gap-2 ${isYou ? "justify-end" : "justify-start"
// 																}`}>
// 															{/* COPY — YOUR MESSAGE */}
// 															{isYou && (
// 																<button
// 																	onClick={() => {
// 																		navigator.clipboard.writeText(msg.text)
// 																	}}
// 																	title="Copy message"
// 																	className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/50 text-slate-600 opacity-0 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-300 group-hover:opacity-100">
// 																	<svg
// 																		viewBox="0 0 24 24"
// 																		className="h-3.5 w-3.5"
// 																		fill="none"
// 																		stroke="currentColor"
// 																		strokeWidth="1.8">
// 																		<rect
// 																			x="9"
// 																			y="9"
// 																			width="11"
// 																			height="11"
// 																			rx="2"
// 																		/>
// 																		<path
// 																			strokeLinecap="round"
// 																			strokeLinejoin="round"
// 																			d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3"
// 																		/>
// 																	</svg>
// 																</button>
// 															)}

// 															{/* MESSAGE */}
// 															<div
// 																className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${isYou
// 																	? "rounded-br-md border border-sky-400/20 bg-sky-500/[0.10]"
// 																	: "rounded-bl-md border border-slate-800 bg-[#0c121d]"
// 																	}`}>
// 																{/* Sender */}
// 																<div
// 																	className={`mb-1 text-[10px] font-semibold ${isYou ? "text-sky-400/80" : "text-slate-500"
// 																		}`}>
// 																	{isYou ? "You" : msg.senderDeviceName}
// 																</div>

// 																{/* Text */}
// 																<p
// 																	className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed ${isYou ? "text-slate-200" : "text-slate-300"
// 																		}`}>
// 																	{msg.text}
// 																</p>
// 															</div>

// 															{/* COPY — INCOMING MESSAGE */}
// 															{!isYou && (
// 																<button
// 																	onClick={() => {
// 																		navigator.clipboard.writeText(msg.text)
// 																	}}
// 																	title="Copy message"
// 																	className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/50 text-slate-600 opacity-0 transition-all duration-200 hover:border-slate-700 hover:bg-slate-800 hover:text-slate-300 group-hover:opacity-100">
// 																	<svg
// 																		viewBox="0 0 24 24"
// 																		className="h-3.5 w-3.5"
// 																		fill="none"
// 																		stroke="currentColor"
// 																		strokeWidth="1.8">
// 																		<rect
// 																			x="9"
// 																			y="9"
// 																			width="11"
// 																			height="11"
// 																			rx="2"
// 																		/>
// 																		<path
// 																			strokeLinecap="round"
// 																			strokeLinejoin="round"
// 																			d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3"
// 																		/>
// 																	</svg>
// 																</button>
// 															)}
// 														</div>
// 													)
// 												})
// 											)}
// 										</div>
// 									</div>
// 								</div>
// 							</div>
// 						)}

// 						{/* P2P Workspace (Blank as requested) */}
// 						{activeTab === "p2p" && (
// 							<div className="min-h-[260px] rounded-2xl border border-slate-800 bg-slate-900">
// 								{/* Blank P2P Div Container */}
// 							</div>
// 						)}
// 					</div>
// 				</div>
// 			</div>
// 		</div>
// 	)




return (
		<div
			ref={Container}
			className="relative w-screen h-screen flex flex- items-center overflow-hidden bg-[#121109] text-[#E8E3D5] eb-grain">
			<button
				className="absolute z-10000 bottom-0 right-0 rounded-tl-[10px] border-t border-l border-[#E8E3D5]/12 bg-[#1C1B14] px-3.5 py-2 font-mono text-[11px] tracking-wide text-[#8A8576] transition-colors hover:bg-[#232219] hover:text-[#C2552F] eb-focus"
				onClick={resetStorage}>
				Reset app data
			</button>

			{/* hero text */}
			{!isHeroAnimationDone && (
				<div
					ref={heroRef}
					id="heroText"
					className="absolute z-500 inset-0 neon-font">
					<StrokeText
						className="tile absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-2/3 "
						text="Escape-Bridge"
						strokeColor="#C2552F"
						fillColor="#EDE8DA"
						strokeWidth={1}
						drawDuration={1}
						fillDelay={0}
						stagger={0.05}
						ease="power2.out"
						trigger="mount"
						fillMode="wipe"
						fontSize={130}
						fontWeight={800}
						letterSpacing={-4}
						reverse={false}
						onComplete={handleStrokeComplete}
					/>
				</div>
			)}

			{/* intro para */}
			{needsDeviceSetup && (
				<div
					ref={introRef}
					id="introPara"
					className="absolute z-500 h-full w-full flex items-center justify-center opacity-0 pointer-events-none">
					<Intro
						deviceName={deviceName}
						setDeviceNameState={setDeviceNameState}
						handleDeviceSetup={handleDeviceSetup}
						handleIntroSetupDone={handleIntroSetupDone}
					/>
				</div>
			)}

			{/* Main site things */}
			<div className="w-full h-full flex flex-col font-['Inter_Tight','Inter',system-ui,-apple-system,sans-serif]">
				{/* ROP BAR */}
				<div className="w-full h-auto py-3 md:py-0 md:h-[10%] grid grid-cols-3 gap-y-3 border-b border-[#E8E3D5]/10 bg-[#15140D]/70">
					{/* Side logo */}

					{/* Desktop / larger screens */}
					<h1
						id="logo"
						className="hidden md:flex items-center gap-2.5 font-extrabold text-[17px] tracking-[-0.02em] text-[#EDE8DA] justify-self-start self-center h-fit ml-[2vw] opacity-0">
						<span className="inline-block h-[14px] w-[3px] rounded-full bg-[#C2552F]" />
						Escape-Bridge
					</h1>

					{/* Top Navigation Tabs */}
					<div
						id="navTabs"
						className="col-span-3 md:col-span-1 justify-self-center self-center opacity-0">
						<div className="flex rounded-[10px] border border-[#E8E3D5]/12 bg-[#1A1912] p-1 h-10 w-fit shadow-[inset_0_1px_0_rgba(232,227,213,0.05)]">
							<button
								onClick={() => setActiveTab("room")}
								className={`cursor-pointer rounded-[7px] border-none px-6 sm:px-7 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200 ease-in-out eb-focus ${activeTab === "room"
									? "bg-[#26251C] text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.08),0_1px_2px_rgba(0,0,0,0.5)]"
									: "bg-transparent text-[#7E7A6B] hover:text-[#B5AF9D] shadow-none"
									}`}>
								Room
							</button>

							<button
								onClick={() => setActiveTab("p2p")}
								className={`cursor-pointer rounded-[7px] border-none px-6 sm:px-7 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-all duration-200 ease-in-out eb-focus ${activeTab === "p2p"
									? "bg-[#26251C] text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.08),0_1px_2px_rgba(0,0,0,0.5)]"
									: "bg-transparent text-[#7E7A6B] hover:text-[#B5AF9D] shadow-none"
									}`}>
								P2P
							</button>
						</div>
					</div>

					{/* navbar create and join room buttons  */}
					<div className="col-span-3 md:col-span-1 h-full w-full flex gap-4 justify-center items-center">
						<div className="h-full w-full flex gap-3 sm:gap-4 justify-center items-center px-3 md:px-0">
							{/* CREATE ROOM CONTAINER */}
							<div className="relative flex w-[46%] md:w-1/3 h-10 md:h-1/2 items-center justify-center">
								{/* Absolute Room Code display (Fades in/out from left) */}
								<div
									className={`absolute right-full mr-3 h-full flex items-center rounded-[9px] border border-[#E8E3D5]/12 bg-[#1A1912] overflow-hidden shadow-[0_6px_18px_-10px_rgba(0,0,0,0.9)] transition-all duration-300 ease-out ${roomCode
										? "opacity-100 translate-x-0 pointer-events-auto"
										: "opacity-0 -translate-x-4 pointer-events-none"
										}`}>
									<button
										onClick={() =>
											roomCode && navigator.clipboard.writeText(roomCode)
										}
										className="h-full px-3.5 flex items-center justify-center text-[#8A8576] transition-colors hover:bg-[#E8E3D5]/[0.06] hover:text-[#C2552F] eb-focus"
										title="Copy room code">
										<svg
											width="18"
											height="18"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round">
											<rect x="9" y="9" width="13" height="13" rx="2" />
											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
										</svg>
									</button>

									<div className="h-3/5 w-px bg-[#E8E3D5]/12" />

									<span className="px-4 font-mono text-[14px] font-semibold tracking-[0.22em] text-[#EDE8DA] whitespace-nowrap">
										{roomCode}
									</span>
								</div>

								{/* Create Room Button */}
								<button
									onClick={() => {
										if (roomCode) {
											setRoomCode("") // Clears active state when ESC/close is clicked
										} else {
											createRoom()
											createRoomButtonAnimation()
										}
									}}
									className="eb-tactile eb-focus flex w-full h-full items-center justify-center gap-2 rounded-[9px] bg-[#C2552F] px-4 text-[13px] font-semibold tracking-[-0.01em] text-[#1A0E08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.28),0_6px_16px_-10px_rgba(194,85,47,0.9)] transition hover:bg-[#CE5F37] active:translate-y-px">
									{roomCode ? (
										<span className="text-[12.5px] font-medium tracking-wide text-[#1A0E08]/85">
											Press{" "}
											<kbd className="rounded bg-[#1A0E08]/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#1A0E08]">
												ESC
											</kbd>{" "}
											to close
										</span>
									) : (
										<>
											<span className="text-[18px] leading-none">+</span>
											Create room
										</>
									)}
								</button>
							</div>

							{/* JOIN ROOM CONTAINER */}
							<div className="relative w-[46%] md:w-1/3 h-10 md:h-1/2 flex flex-col items-center justify-center">
								{/* Join Room Button */}
								<button
									ref={joinButtonRef}
									onClick={() => {
										setShowJoinInput((prev) => !prev)
									}}
									className="eb-tactile eb-focus flex w-full h-full items-center justify-center gap-2 rounded-[9px] border border-[#E8E3D5]/14 bg-[#232219] px-4 text-[13px] font-semibold tracking-[-0.01em] text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.07),inset_0_-2px_0_rgba(0,0,0,0.35)] transition hover:bg-[#2B2A20] active:translate-y-px">
									{showJoinInput ? (
										<span className="text-[12.5px] font-medium tracking-wide text-[#B5AF9D]">
											Press{" "}
											<kbd className="rounded bg-[#E8E3D5]/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#EDE8DA]">
												ESC
											</kbd>{" "}
											to close
										</span>
									) : (
										<>
											<span className="text-[16px] text-[#C2552F]">→</span>
											Join room
										</>
									)}
								</button>

								{/* Join Room Input (Fades in/out downwards) */}
								<div
									className={`absolute top-[115%] left-0 w-full flex items-center gap-2 rounded-[10px] border border-[#E8E3D5]/12 bg-[#1A1912] p-2 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.95)] transition-all duration-300 ease-out z-10 ${showJoinInput
										? "opacity-100 translate-y-0 pointer-events-auto"
										: "opacity-0 -translate-y-2 pointer-events-none"
										}`}>
									<input
										ref={joinDialogueInputRef}
										type="text"
										inputMode="numeric"
										maxLength={6}
										placeholder="Enter room code"
										value={joinDialogueCode}
										onChange={(e) => {
											const value = e.target.value.replace(/\D/g, "")
											setJoinDialogueCode(value)
											setRoomCode(value)
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter" && joinDialogueCode.length === 6) {
												joinRoom()
											}
										}}
										className="min-w-0 flex-1 rounded-[7px] bg-[#121109] px-3 py-2 text-center font-mono text-[14px] font-semibold tracking-[0.25em] text-[#EDE8DA] outline-none ring-1 ring-inset ring-[#E8E3D5]/10 focus:ring-[#C2552F]/50 placeholder:font-sans placeholder:tracking-normal placeholder:text-[#6E6A5D]"
									/>

									<button
										onClick={() => {
											if (joinDialogueCode.length === 6) {
												joinRoom()
											}
										}}
										className="eb-tactile eb-focus rounded-[7px] bg-[#C2552F] px-4 py-2 text-[12.5px] font-semibold text-[#1A0E08] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.28)] transition hover:bg-[#CE5F37] active:translate-y-px">
										Join
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* BOTTOM SECTION */}
				<div className="mx-auto mb-4 sm:mb-6 w-[94vw] md:w-[80vw] h-[90%] text-[#E8E3D5]">
					{/* Main Workspace */}
					<div className="h-full ">
						{activeTab === "room" && (
							<div
								id="roomWorkSpace"
								className="relative z-0 flex flex-col h-full justify-center items-center pointer-events-none">
								{needsDeviceSetup && (
									<span
										id="roomIntroText"
										className="absolute inset-0 opacity-0 h-1/6 flex justify-center items-center px-6 text-center text-[#B5AF9D] text-xl sm:text-2xl lg:text-3xl leading-snug tracking-[-0.02em]">
										If u want one time setup and seemeless connectivity , u are
										at right place{" "}
									</span>
								)}

								<div
									id="roomBox"
									className="absolute bottom-0 opacity-0 w-full sm:w-11/12 lg:w-4/5 h-5/6 flex flex-col gap-4 overflow-hidden rounded-t-[22px] border border-b-0 border-[#E8E3D5]/12 bg-[#17160F] p-3 sm:p-5 shadow-[0_-30px_80px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(232,227,213,0.06)] [mask-image:linear-gradient(to_bottom,black_50%,transparent_100%)]">
									{/* this is the create and join room card  */}
									{needsDeviceSetup && (
										<>
											<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 p-1 sm:p-2">
												{/* CREATE ROOM */}
												<div
													id="createRoomCard"
													className="relative overflow-hidden rounded-[16px] border border-[#E8E3D5]/12 bg-[#1C1B14] p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(232,227,213,0.06),0_20px_40px_-32px_rgba(0,0,0,1)]">
													{/* subtle glow */}
													<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C2552F]/50 to-transparent" />

													<div className="relative">
														{/* label */}
														<div className="mb-[18px] flex items-center gap-2.5 font-mono text-[11px] tracking-[0.12em] text-[#7E7A6B]">
															<span className="h-[7px] w-[7px] rounded-full bg-[#C2552F] shadow-[0_0_0_1px_rgba(194,85,47,0.35),inset_0_1px_0_rgba(255,255,255,0.45)]" />
															New session
														</div>

														{/* heading */}
														<h2 className="mb-2 text-[20px] font-bold tracking-[-0.02em] text-[#EDE8DA]">
															Create a room
														</h2>

														{/* description */}
														<p className="mb-6 max-w-[42ch] text-[13.5px] leading-[1.6] text-[#8A8576]">
															Generates a one-time 6-digit code. Share it with
															any device you want to bridge into this room.
														</p>

														{/* create button */}
														<button
															onClick={() => {
																createRoom()
																createRoomButtonAnimation()
															}}
															className="eb-tactile eb-focus flex w-full items-center justify-center gap-2 rounded-[9px] bg-[#C2552F] px-5 py-3 text-[14px] font-semibold text-[#1A0E08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.28),0_10px_24px_-16px_rgba(194,85,47,0.9)] transition hover:bg-[#CE5F37] active:translate-y-px">
															<span className="text-[18px] leading-none">
																+
															</span>
															Create room
														</button>

														{/* generated code */}
														<div className="mt-[22px]">
															<div className="mb-4 flex flex-wrap gap-2">
																{[0, 1, 2, 3, 4, 5].map((index) => (
																	<div
																		key={index}
																		className={`min-w-[48px] sm:min-w-[54px] min-h-[60px] sm:min-h-[64px] flex items-center justify-center rounded-[8px] border border-[#E8E3D5]/10 bg-[#121109] px-3 py-2 text-center font-mono text-[28px] sm:text-[30px] font-semibold text-[#EDE8DA] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] ${index === 3 ? "ml-1" : ""
																			}`}>
																		{displayRoomCode?.[index] || ""}
																	</div>
																))}
															</div>

															{/* copy/share */}
															<div className="flex gap-[10px]">
																<button
																	onClick={() => {
																		navigator.clipboard.writeText(
																			displayRoomCode,
																		)
																	}}
																	className="eb-tactile eb-focus flex w-auto items-center justify-center gap-2 rounded-[8px] border border-[#E8E3D5]/12 bg-[#232219] px-3.5 py-2 text-[12.5px] font-semibold text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.06)] transition hover:border-[#E8E3D5]/20 hover:bg-[#2B2A20] active:translate-y-px">
																	Copy code
																</button>

																<button className="eb-tactile eb-focus flex w-auto items-center justify-center gap-2 rounded-[8px] border border-[#E8E3D5]/12 bg-[#232219] px-3.5 py-2 text-[12.5px] font-semibold text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.06)] transition hover:border-[#E8E3D5]/20 hover:bg-[#2B2A20] active:translate-y-px">
																	Share
																</button>
															</div>
														</div>
													</div>
												</div>

												{/* JOIN ROOM */}
												<div
													id="joinRoomCard"
													className="relative overflow-hidden rounded-[16px] border border-[#E8E3D5]/12 bg-[#1C1B14] p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(232,227,213,0.06),0_20px_40px_-32px_rgba(0,0,0,1)]">
													{/* subtle glow */}
													<div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#7C8560]/50 to-transparent" />

													<div className="relative">
														{/* label */}
														<div className="mb-[18px] flex items-center gap-2.5 font-mono text-[11px] tracking-[0.12em] text-[#7E7A6B]">
															<span className="h-[7px] w-[7px] rounded-full bg-[#9DB06A] shadow-[0_0_0_1px_rgba(157,176,106,0.3),inset_0_1px_0_rgba(255,255,255,0.45)]" />
															Join session
														</div>

														{/* heading */}
														<h2 className="mb-2 text-[20px] font-bold tracking-[-0.02em] text-[#EDE8DA]">
															Join a room
														</h2>

														{/* description */}
														<p className="mb-6 max-w-[42ch] text-[13.5px] leading-[1.6] text-[#8A8576]">
															Enter the 6-digit code shown on the other device
															to bridge into their room.
														</p>

														{/* OTP */}
														<div className="mb-5 flex gap-2">
															<CodeInput
																onComplete={handleCodeComplete}
															// nextFocusRef={joinButtonRef}
															/>
														</div>

														{/* join */}
														<button
															ref={joinButtonRef}
															onClick={joinRoom}
															className="eb-tactile eb-focus flex w-full items-center justify-center gap-2 rounded-[9px] border border-[#E8E3D5]/14 bg-[#232219] px-5 py-3 text-[14px] font-semibold text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.07),inset_0_-2px_0_rgba(0,0,0,0.35)] transition hover:bg-[#2B2A20] active:translate-y-px">
															<span className="text-[16px] text-[#C2552F]">→</span>
															Join room
														</button>

														{/* helper */}
														<p className="mt-3 text-[12.5px] text-[#6E6A5D]">
															Codes are 6 digits and expire when the room
															closes.
														</p>
													</div>
												</div>
											</div>

											<div id="roomCardText" className="mt-16">
												<span
													id="roomSelectionText-1"
													className="opacity-0 h-fit rounded-[14px] border border-[#E8E3D5]/10 bg-[#1C1B14] px-6 py-5 flex justify-center items-center text-center text-[#B5AF9D] text-xl sm:text-2xl lg:text-3xl leading-snug tracking-[-0.02em]">
													Just create a room, copy the code and paste it on the
													other device
												</span>
												<span
													id="roomSelectionText-2"
													className="opacity-0 h-fit flex justify-center items-center px-6 text-center text-[#B5AF9D] text-xl sm:text-2xl lg:text-3xl leading-snug tracking-[-0.02em]">
													Congrats!! U just created a room <br />
													Now paste the code on other device and witness the
													happening
												</span>
											</div>
										</>
									)}

									{/* Room Switcher */}
									<div className="flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-[10px] border border-[#E8E3D5]/12 bg-[#1C1B14] p-1.5 shadow-[inset_0_1px_0_rgba(232,227,213,0.06)] eb-scroll">
										<div className="shrink-0 px-2 font-mono text-[10px] tracking-[0.12em] text-[#6E6A5D] border-r border-[#E8E3D5]/12 mr-1 select-none">
											Active rooms
										</div>
										{Object.keys(rooms).map((code) => {
											const isActive = activeRoomCode === code
											return (
												<button
													key={code}
													onClick={() => setActiveRoomCode(code)}
													className={`relative flex shrink-0 items-center gap-2 rounded-[7px] px-3 py-1.5 font-mono text-xs font-semibold tracking-[0.08em] transition-all duration-200 cursor-pointer eb-focus ${isActive
														? "bg-[#2E2C21] text-[#EDE8DA] shadow-[inset_0_1px_0_rgba(232,227,213,0.08)]"
														: "bg-transparent text-[#7E7A6B] hover:bg-[#E8E3D5]/[0.05] hover:text-[#B5AF9D]"
														}`}>
													<span
														className={`h-1.5 w-1.5 rounded-full ${isActive
															? "bg-[#C2552F] shadow-[0_0_0_1px_rgba(194,85,47,0.35),0_0_6px_rgba(194,85,47,0.55)]"
															: "bg-[#4A473C]"
															}`}
													/>
													{code}
												</button>
											)
										})}
									</div>

									{/* Devices Grid / List */}
									<div
										id="DeviceGridList"
										className="h-1/2 grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] content-start gap-3 sm:gap-4 overflow-y-auto p-1 sm:p-2 opacity-0 eb-scroll">
										{activeRoomDevices.length === 0 && (
											<div className="col-span-full rounded-[14px] border border-dashed border-[#E8E3D5]/12 bg-[#1A1912] px-5 py-10 text-center">
												<p className="text-sm font-semibold text-[#B5AF9D]">
													No devices connected to this room yet.
												</p>
												<p className="mt-1.5 text-xs text-[#6E6A5D]">
													Share the room code and the other device will appear
													here.
												</p>
											</div>
										)}

										{activeRoomDevices
											.filter((device) => device.deviceId !== getDeviceID())
											.map((device) => {
												const isCurrentDevice =
													device.deviceId === getDeviceID()
												const isConnected =
													activeRoom?.peerStatus[device.deviceId] ?? false
												const selectedFile =
													activeRoom?.selectedFiles[device.deviceId] ?? null
												const isExpanded = expandedDevice === device.deviceId

												return (
													<div
														key={device.deviceId}
														className={`
    w-full max-w-xl overflow-hidden rounded-[14px]
    border bg-[#1C1B14]
    transition-all duration-300
    ${isExpanded ? "h-56" : "h-16"}
    ${device.online
																? isConnected
																	? "border-[#7C8560]/55 shadow-[inset_0_1px_0_rgba(232,227,213,0.06),0_14px_30px_-24px_rgba(0,0,0,1)]"
																	: "border-[#E8E3D5]/12 shadow-[inset_0_1px_0_rgba(232,227,213,0.05)]"
																: "cursor-not-allowed opacity-55 border-[#E8E3D5]/8"
															}
  `}
														onMouseEnter={() => {
															if (device.online) {
																setExpandedDevice(device.deviceId)
															}
														}}
														onMouseLeave={() => {
															if (device.online) {
																setExpandedDevice(null)
															}
														}}
														onClick={() => {
															if (device.online) {
																setExpandedDevice((prev) =>
																	prev === device.deviceId
																		? null
																		: device.deviceId,
																)
															}
														}}>
														{/* ================= COLLAPSED HEADER ================= */}

														<div className="flex h-16 items-center gap-2.5 sm:gap-3 px-3 sm:px-4 text-[#B5AF9D]">
															{/* Device icon */}
															<DeviceIcon
																deviceType={
																	activeRoom?.remoteDeviceInfo[device.deviceId]?.deviceType ?? "unknown"
																}
																size={28}
															/>

															{/* Online status */}
															<span
																className={` h-2.5 w-2.5 shrink-0 rounded-full ${device.online
																	? "bg-[#9DB06A] shadow-[0_0_0_1px_rgba(157,176,106,0.35),0_0_7px_rgba(157,176,106,0.5),inset_0_1px_0_rgba(255,255,255,0.45)]"
																	: "bg-[#4A473C] shadow-[inset_0_1px_0_rgba(232,227,213,0.08)]"}`}
															/>

															{/* Device name + badges */}
															<div className="min-w-0 shrink-0 max-w-[38%] sm:max-w-none">
																<h3 className="m-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-[#EDE8DA]">
																	{device.deviceName}
																</h3>

																<div className="mt-0.5 flex gap-1">
																	{device.isHost && (
																		<span className="rounded-[4px] border border-[#C9922F]/35 bg-[#C9922F]/12 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.08em] text-[#C9922F]">
																			HOST
																		</span>
																	)}

																	{isCurrentDevice && (
																		<span className="rounded-[4px] border border-[#E8E3D5]/20 bg-[#E8E3D5]/10 px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.08em] text-[#B5AF9D]">
																			YOU
																		</span>
																	)}
																</div>
															</div>

															{/* Message input */}
															<input
																disabled={!device.online}
																placeholder={`Message to ${device.deviceName}...`}
																value={activeRoom?.deviceMessages?.[device.deviceId] || ""}
																onFocus={() => {
																	if (!isCurrentDevice && device.online) {
																		const room = roomsRef.current.get(roomCode)
																		const channel = room?.dataChannels.get(
																			device.deviceId,
																		)

																		if (channel?.readyState === "open") {
																			resetRoomPeerTimer(
																				roomCode,
																				device.deviceId,
																			)
																		}

																		ensureRoomConnection(roomCode, device)
																	}
																}}
																onChange={(e) => {
																	const value = e.target.value

																	if (!activeRoomCode) return

																	const room = roomsRef.current.get(activeRoomCode)
																	if (!room) return

																	room.deviceMessages = {
																		...room.deviceMessages,
																		[device.deviceId]: value,
																	}

																	setRooms((prev) => ({
																		...prev,
																		[activeRoomCode]: room,
																	}))
																}}
																onKeyDown={(e) => {
																	if (e.key === "Enter") {
																		const text =
																			activeRoom?.deviceMessages?.[device.deviceId]

																		if (text && text.trim()) {
																			sendRoomMessage(roomCode, device, text)

																			if (!activeRoomCode) return

																			const room = roomsRef.current.get(activeRoomCode)
																			if (!room) return

																			room.deviceMessages = {
																				...room.deviceMessages,
																				[device.deviceId]: "",
																			}

																			setRooms((prev) => ({
																				...prev,
																				[activeRoomCode]: room,
																			}))
																		}
																	}
																}}
																onClick={(e) => e.stopPropagation()}
																className={` min-w-0 flex-1 rounded-[8px] bg-[#121109] px-3 py-2 text-xs outline-none ring-1 ring-inset ring-[#E8E3D5]/10 transition focus:ring-[#C2552F]/45 ${device.online
																	? "text-[#EDE8DA] placeholder:text-[#6E6A5D]"
																	: "cursor-not-allowed text-[#5A574C] placeholder:text-[#4A473C]"
																	}
  `}
															/>

															{/* Connection button */}
															{/* {!isCurrentDevice &&
																device.online &&
																(isConnected ? (
																	<button
																		onClick={(e) => {
																			e.stopPropagation()

																			disconnectFromRoomDevice(
																				roomCode,
																				device.deviceId,
																			)
																		}}
																		className="
                  shrink-0 rounded-lg
                  border border-rose-500/30
                  bg-rose-500/10
                  px-3 py-2
                  text-xs font-semibold
                  text-rose-500
                ">
																		Disconnect
																	</button>
																) : (
																	<button
																		onClick={(e) => {
																			e.stopPropagation()

																			connectToRoomDevice(roomCode, device)
																		}}
																		className="
                  shrink-0 rounded-lg
                  bg-blue-600
                  px-3 py-2
                  text-xs font-semibold
                  text-white
                ">
																		Connect
																	</button>
																))} */}

															{/* Paste */}
															<button
																disabled={!device.online}
																onClick={async (e) => {
																	e.stopPropagation()

																	const text =
																		await navigator.clipboard.readText()

																	if (!activeRoomCode) return

																	const room = roomsRef.current.get(activeRoomCode)
																	if (!room) return

																	room.deviceMessages = {
																		...room.deviceMessages,
																		[device.deviceId]: text,
																	}

																	setRooms((prev) => ({
																		...prev,
																		[activeRoomCode]: room,
																	}))
																}}
																className={`
    shrink-0 rounded-[8px] border px-3 py-2 text-xs font-semibold transition eb-focus
    ${device.online
																		? "border-[#E8E3D5]/12 bg-[#232219] text-[#B5AF9D] hover:border-[#E8E3D5]/20 hover:bg-[#2B2A20] hover:text-[#EDE8DA] active:translate-y-px"
																		: "cursor-not-allowed border-transparent bg-transparent text-[#4A473C]"
																	}
  `}>
																Paste
															</button>
														</div>

														{/* ================= EXPANDED FILE AREA ================= */}

														<div
															className={`
            flex flex-col gap-3 border-t border-[#E8E3D5]/8 px-3 sm:px-4 pt-3 pb-4
            transition-all duration-300
            ${isExpanded
																	? "translate-y-0 opacity-100"
																	: "pointer-events-none -translate-y-2 opacity-0"
																}
          `}>
															{/* File picker */}

															<input
																id={`file-${device.deviceId}`}
																type="file"
																className="hidden"
																onChange={(e) => {
																	const file = e.target.files?.[0] ?? null

																	if (!activeRoomCode) return

																	const room =
																		roomsRef.current.get(activeRoomCode)
																	if (!room) return

																	room.selectedFiles = {
																		...room.selectedFiles,
																		[device.deviceId]: file,
																	}

																	setRooms((prev) => ({
																		...prev,
																		[activeRoomCode]: room,
																	}))

																	// Allow selecting the same file again later
																	e.target.value = ""
																}}
															/>

															<label
																htmlFor={`file-${device.deviceId}`}
																onClick={(e) => e.stopPropagation()}
																className={`
              block w-full
              cursor-pointer
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              rounded-[8px]
              border border-dashed border-[#E8E3D5]/16
              bg-[#121109]
              px-3 py-2.5
              text-center
              text-xs
              transition
              hover:border-[#C2552F]/45 hover:bg-[#161509]
              ${selectedFile ? "text-[#EDE8DA]" : "text-[#7E7A6B]"}
            `}>
																{selectedFile
																	? selectedFile.name
																	: "Choose file"}
															</label>

															{/* Send file */}

															{!isCurrentDevice &&
																device.online &&
																isConnected && (
																	<button
																		onClick={(e) => {
																			e.stopPropagation()

																			if (!selectedFile) {
																				console.log(
																					"No file selected for",
																					device.deviceId,
																				)
																				return
																			}

																			sendFileToRoomDevice(
																				roomCode,
																				device.deviceId,
																				selectedFile,
																			)
																		}}
																		disabled={!selectedFile}
																		className={`
                  w-full rounded-[8px]
                  p-2.5
                  text-xs font-semibold
                  transition-all duration-200 eb-focus
                  ${selectedFile
																				? "cursor-pointer bg-[#7C8560] text-[#10130A] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-2px_0_rgba(0,0,0,0.25)] hover:bg-[#8B9469] active:translate-y-px"
																				: "cursor-not-allowed border border-[#E8E3D5]/8 bg-[#1A1912] text-[#5A574C]"
																			}
                `}>
																		Send Selected File
																	</button>
																)}
														</div>
													</div>
												)
											})}
									</div>

									{/* Room Messages */}
									<div
										id="RoomMessages"
										className="flex h-1/2 flex-col rounded-[16px] border border-[#E8E3D5]/12 bg-[#1A1912] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(232,227,213,0.05),0_20px_44px_-34px_rgba(0,0,0,1)]">
										{/* Header */}
										<div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E8E3D5]/8 pb-3">
											<div>
												<h3 className="text-sm font-semibold tracking-[-0.01em] text-[#EDE8DA]">
													Room messages
												</h3>

												<p className="mt-1 text-[11px] text-[#6E6A5D]">
													Messages from devices in this room
												</p>
											</div>

											<div className="shrink-0 rounded-full border border-[#E8E3D5]/12 bg-[#232219] px-2.5 py-1 font-mono text-[10px] font-medium text-[#8A8576]">
												{activeRoom?.messages.length ?? 0}{" "}
												{(activeRoom?.messages.length ?? 0) === 1 ? "message" : "messages"}
											</div>
										</div>

										{/* Messages */}
										<div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1 eb-scroll">
											{(activeRoom?.messages.length ?? 0) === 0 ? (
												<div className="flex flex-1 flex-col items-center justify-center text-center">
													<div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#E8E3D5]/12 bg-[#232219] text-[#7E7A6B]">
														<svg
															viewBox="0 0 24 24"
															className="h-5 w-5"
															fill="none"
															stroke="currentColor"
															strokeWidth="1.7">
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																d="M8 10h8M8 14h5m7-2a8 8 0 11-15.3 3.3L3 21l5.7-1.7A8 8 0 0021 12z"
															/>
														</svg>
													</div>

													<p className="text-xs font-semibold text-[#B5AF9D]">
														No messages yet
													</p>

													<p className="mt-1 max-w-[34ch] text-[11px] leading-relaxed text-[#6E6A5D]">
														Messages from connected devices will appear here
													</p>
												</div>
											) : (
												(activeRoom?.messages ?? []).map((msg) => {
													const isYou = msg.senderDeviceId === getDeviceID()

													return (
														<div
															key={`${msg.senderDeviceId}-${msg.text}-${(activeRoom?.messages ?? []).indexOf(msg)}`}
															className={`group flex w-full items-center gap-2 ${isYou ? "justify-end" : "justify-start"
																}`}>
															{/* COPY — YOUR MESSAGE */}
															{isYou && (
																<button
																	onClick={() => {
																		navigator.clipboard.writeText(msg.text)
																	}}
																	title="Copy message"
																	className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#E8E3D5]/10 bg-[#232219] text-[#7E7A6B] opacity-0 transition-all duration-200 hover:border-[#E8E3D5]/20 hover:bg-[#2B2A20] hover:text-[#EDE8DA] group-hover:opacity-100 focus-visible:opacity-100 eb-focus">
																	<svg
																		viewBox="0 0 24 24"
																		className="h-3.5 w-3.5"
																		fill="none"
																		stroke="currentColor"
																		strokeWidth="1.8">
																		<rect
																			x="9"
																			y="9"
																			width="11"
																			height="11"
																			rx="2"
																		/>
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3"
																		/>
																	</svg>
																</button>
															)}

															{/* MESSAGE */}
															<div
																className={`max-w-[80%] sm:max-w-[75%] rounded-[14px] px-3.5 py-2.5 ${isYou
																	? "rounded-br-[4px] border border-[#C2552F]/35 bg-[#C2552F]/[0.10]"
																	: "rounded-bl-[4px] border border-[#E8E3D5]/10 bg-[#141309]"
																	}`}>
																{/* Sender */}
																<div
																	className={`mb-1 font-mono text-[10px] font-semibold tracking-[0.06em] ${isYou ? "text-[#C2552F]" : "text-[#7E7A6B]"
																		}`}>
																	{isYou ? "You" : msg.senderDeviceName}
																</div>

																{/* Text */}
																<p
																	className={`whitespace-pre-wrap break-words text-[13px] leading-relaxed ${isYou ? "text-[#EDE8DA]" : "text-[#C6C0AE]"
																		}`}>
																	{msg.text}
																</p>
															</div>

															{/* COPY — INCOMING MESSAGE */}
															{!isYou && (
																<button
																	onClick={() => {
																		navigator.clipboard.writeText(msg.text)
																	}}
																	title="Copy message"
																	className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[#E8E3D5]/10 bg-[#232219] text-[#7E7A6B] opacity-0 transition-all duration-200 hover:border-[#E8E3D5]/20 hover:bg-[#2B2A20] hover:text-[#EDE8DA] group-hover:opacity-100 focus-visible:opacity-100 eb-focus">
																	<svg
																		viewBox="0 0 24 24"
																		className="h-3.5 w-3.5"
																		fill="none"
																		stroke="currentColor"
																		strokeWidth="1.8">
																		<rect
																			x="9"
																			y="9"
																			width="11"
																			height="11"
																			rx="2"
																		/>
																		<path
																			strokeLinecap="round"
																			strokeLinejoin="round"
																			d="M15 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7a2 2 0 002 2h3"
																		/>
																	</svg>
																</button>
															)}
														</div>
													)
												})
											)}
										</div>
									</div>
								</div>
							</div>
						)}

						{/* P2P Workspace (Blank as requested) */}
						{activeTab === "p2p" && (
							<div className="min-h-[260px] h-full rounded-[16px] border border-[#E8E3D5]/12 bg-[#1A1912] shadow-[inset_0_1px_0_rgba(232,227,213,0.05)]">
								{/* Blank P2P Div Container */}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
