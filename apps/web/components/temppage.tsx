                       {/* Room Controls & Global File Bar */}
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">

                    {/* Room Connect / Create Bar */}
                    <div className="flex gap-2.5">
                      <CodeInput onComplete={() => { otpbuttonRef.current?.focus() }} />


                      <button
                        onClick={joinRoom}
                        className="cursor-pointer rounded-[10px] border-none bg-blue-600 px-[18px] py-2.5 text-[13px] font-semibold text-white"
                      >
                        Join Room
                      </button>

                      <button
                        onClick={createRoom}
                        className="cursor-pointer rounded-[10px] border border-slate-700 bg-transparent px-[18px] py-2.5 text-[13px] font-semibold text-slate-50"
                      >
                        Create
                      </button>
                    </div>

                    {/* Global Selected File Bar
                    <div className="flex items-center justify-between rounded-[10px] border border-dashed border-slate-700 bg-[#090d16] px-3.5 py-2.5">
                      <span className="text-[13px] text-slate-400">
                        {selectedFile
                          ? `Selected: ${selectedFile.name}`
                          : 'No global file selected'}
                      </span>

                      <input
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          setSelectedFile(file);
                        }}
                        className="text-xs text-slate-400"
                      />
                    </div> */}
                  </div>
                  
                  
                  {/* Devices Grid / List */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">

                    {roomDevices.length === 0 && (
                      <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900 px-5 py-10 text-center text-sm text-slate-500">
                        No devices connected to this room yet.
                      </div>
                    )}

                    {roomDevices
                      .filter((device) => device.deviceId !== getDeviceID())
                      .map((device) => {
                        const isCurrentDevice =
                          device.deviceId === getDeviceID();

                        const isConnected =
                          roomPeerStatus[device.deviceId];

                        return (
                          <div
                            key={device.deviceId}
                            className={`flex flex-col gap-4 rounded-2xl bg-slate-900 p-5 ${isConnected
                              ? 'border border-sky-400/40 shadow-[0_0_15px_rgba(56,189,248,0.05)]'
                              : 'border border-slate-800'
                              }`}
                          >

                            {/* Device Header */}
                            <div className="flex items-start justify-between">

                              <div>
                                <div className="flex items-center gap-2">

                                  <DeviceIcon
                                    deviceType={
                                      remoteDeviceInfo[device.deviceId]
                                        ?.deviceType ?? 'unknown'
                                    }
                                    size={30}
                                  />

                                  <span
                                    className={`h-2 w-2 rounded-full ${device.online
                                      ? 'bg-emerald-500'
                                      : 'bg-rose-500'
                                      }`}
                                  />

                                  <h3 className="m-0 text-[15px] font-bold text-slate-50">
                                    {device.deviceName}
                                  </h3>
                                </div>

                                <div className="mt-1.5 flex gap-1.5">

                                  {device.isHost && (
                                    <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
                                      HOST
                                    </span>
                                  )}

                                  {isCurrentDevice && (
                                    <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-400">
                                      YOU
                                    </span>
                                  )}

                                </div>
                              </div>

                              {/* Connection State / Button */}
                              {!isCurrentDevice &&
                                device.online &&
                                (isConnected ? (
                                  <button
                                    onClick={() =>
                                      disconnectFromRoomDevice(
                                        device.deviceId
                                      )
                                    }
                                    className="cursor-pointer rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-500"
                                  >
                                    Disconnect
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      connectToRoomDevice(device)
                                    }
                                    className="cursor-pointer rounded-lg border-none bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                                  >
                                    Connect
                                  </button>
                                ))}
                            </div>

                            {/* Card Actions (Text & Send File) */}
                            <div className="mt-auto flex flex-col gap-2">

                              <input
                                placeholder={`Message to ${device.deviceName}...`}
                                value={
                                  deviceMessages?.[device.deviceId] || ''
                                }
                                onFocus={() => {
                                  if (
                                    !isCurrentDevice &&
                                    device.online
                                  ) {
                                    const channel =
                                      roomDataChannels.current.get(
                                        device.deviceId
                                      );

                                    if (
                                      channel?.readyState === 'open'
                                    ) {
                                      resetRoomPeerTimer(
                                        device.deviceId
                                      );
                                    }

                                    ensureRoomConnection(device);
                                  }
                                }}
                                onChange={(e) => {
                                  const value = e.target.value;

                                  setDeviceMessages((prev) => ({
                                    ...prev,
                                    [device.deviceId]: value,
                                  }));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const text =
                                      deviceMessages?.[
                                      device.deviceId
                                      ];

                                    if (text && text.trim()) {
                                      sendRoomMessage(
                                        device,
                                        text
                                      );

                                      setDeviceMessages((prev) => ({
                                        ...prev,
                                        [device.deviceId]: '',
                                      }));
                                    }
                                  }
                                }}
                                className="box-border w-full rounded-lg border border-slate-800 bg-[#090d16] px-3 py-2 text-xs text-slate-50 outline-none"
                              />

                              {!isCurrentDevice &&
                                device.online &&
                                isConnected && (
                                  <button
                                    onClick={() => {
                                      if (!selectedFile) {
                                        console.log(
                                          'No file selected'
                                        );
                                        return;
                                      }

                                      sendFileToRoomDevice(
                                        device.deviceId,
                                        selectedFile
                                      );
                                    }}
                                    disabled={!selectedFile}
                                    className={`w-full rounded-lg border-none p-2 text-xs font-semibold transition-all duration-200 ${selectedFile
                                      ? 'cursor-pointer bg-emerald-600 text-white'
                                      : 'cursor-not-allowed bg-slate-800 text-slate-500'
                                      }`}
                                  >
                                    Send Selected File
                                  </button>
                                )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Room Messages */}
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">

                    <h3 className="mb-3 text-sm text-slate-50">
                      Room Messages
                    </h3>

                    {receivedMessages.length === 0 ? (
                      <div className="text-[13px] text-slate-500">
                        No messages yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {receivedMessages.map((msg, index) => (
                          <div
                            key={index}
                            className="rounded-lg bg-[#090d16] px-3 py-2 text-[13px] text-slate-300"
                          >
                            {msg}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>