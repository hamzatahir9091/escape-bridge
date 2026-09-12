# 🌉 Escape Bridge

> **A simple bridge between your devices.**

Escape Bridge is a local-first, peer-to-peer device communication and file-sharing app.

The idea is pretty simple:

**Your devices should be able to talk to each other without needing an account, installing some random desktop app, or uploading everything to a server first.**

Need to send a message from your phone to your laptop?

Need to move a file from your PC to another device?

Just open Bridge, connect the devices, and transfer.

No accounts.
No complicated setup.
Just a temporary bridge between your devices.

---

## ✨ Why We Built This

We've all had that moment:

> "I just need to send this file from my phone to my laptop."

And then you end up doing one of these:

* Send it to yourself on WhatsApp
* Upload it to Google Drive
* Email it
* Use a USB cable
* Install some file-transfer application
* Search for an AirDrop alternative
* Create an account somewhere

That's way more work than it should be.

So we wanted to build something different.

### The idea

**Open Bridge → connect your devices → send.**

That's it.

The long-term goal is to make Bridge a **Universal Device Bridge** that works across:

* 📱 Android
* 🍎 iPhone
* 💻 Windows
* 🐧 Linux
* 🍎 macOS

The project is intentionally built around temporary connections instead of permanent accounts.

---

# 🚀 Features

### Current

* 🔗 Connect devices through a temporary session
* 🔢 Join using a room/code
* 📱 Device identification and custom device names
* 💬 Real-time messaging
* 👥 Multi-device rooms
* 📡 WebSocket signaling
* 🔄 WebRTC peer-to-peer connections
* 📁 Peer-to-peer file transfer
* 🌐 STUN support for establishing connections
* ⚡ Real-time device communication
* 🖥️ Responsive web interface

### Planned

* 🔐 End-to-end encryption
* 📦 Better large-file handling/chunking
* ☁️ Fallback cloud relay when direct P2P is impossible
* 📱 Better mobile experience
* 🔗 QR-code based pairing
* 📋 Temporary shared clipboard
* 📂 Shared temporary file box
* 🔒 Automatic room cleanup

---

# 🧠 How It Works

Bridge uses a combination of **WebSockets** and **WebRTC**.

The important distinction is:

### WebSocket

The backend is mainly used for **signaling**.

It helps devices discover and exchange the information needed to establish a WebRTC connection.

```text
Device A
   │
   │ WebSocket
   ▼
Bridge Server
   │
   │ WebSocket
   ▼
Device B
```

### WebRTC

Once the connection is established, devices can communicate directly.

```text
Device A
    │
    │
    │   WebRTC
    │
    ▼
Device B
```

So the server doesn't need to handle every message or file transfer.

The goal is:

```text
              Signaling
Device A ──────────────────► Server
Device B ◄────────────────── Server


              P2P
Device A ◄══════════════════► Device B
```

The server helps the devices meet.

**The devices do the actual communication.**

---

# 🏗️ Project Structure

Escape Bridge is organized as a **Turborepo monorepo**.

```text
escape-bridge/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   └── ...
│   │
│   └── server/
│       ├── src/
│       │   ├── index.ts
│       │   └── ...
│       ├── dist/
│       ├── package.json
│       └── ...
│
├── packages/
│   │
│   └── shared/
│       ├── src/
│       │   ├── protocol.ts
│       │   └── ...
│       ├── package.json
│       └── ...
│
├── package.json
├── package-lock.json
├── turbo.json
├── tsconfig.json
└── README.md
```

---

# 📁 Understanding the Structure

## `apps/web`

This is the **frontend**.

It's built with:

* Next.js
* TypeScript
* Tailwind CSS
* React
* GSAP

Everything the user interacts with lives here.

Examples:

```text
apps/web/
├── app/
├── components/
├── hooks/
└── lib/
```

### `app/`

Contains the Next.js application and routes.

### `components/`

Reusable UI components.

For example:

* Device cards
* Chat messages
* File transfer UI
* Room UI
* Connection interface

### `hooks/`

Custom React hooks.

Used for things like:

* WebSocket connections
* WebRTC logic
* Room state
* Device state

### `lib/`

Reusable frontend logic and utilities.

---

# 🖥️ `apps/server`

This is the **backend/signaling server**.

It uses:

* Node.js
* Express
* WebSocket (`ws`)
* TypeScript

The server is **not intended to be the main data-transfer server**.

Its main job is helping devices establish connections.

For example:

```text
CREATE_ROOM
     ↓
JOIN_ROOM
     ↓
DEVICE_REGISTER
     ↓
Exchange WebRTC information
     ↓
WebRTC connection established
     ↓
Direct communication
```

---

# 📦 `packages/shared`

This package contains code that needs to be shared between the frontend and backend.

The biggest example is the **communication protocol**.

Instead of defining a message differently in the frontend and backend:

```ts
{
  type: "CREATE_ROOM"
}
```

we define the protocol once and share it.

That means both applications understand the same message structure.

```text
             packages/shared
                   │
          ┌────────┴────────┐
          ▼                 ▼
      apps/web          apps/server
```

This prevents the frontend and backend from slowly developing different ideas about what messages mean.

---

# 🔄 How the Apps Work Together

At a high level:

```text
                    ┌─────────────────┐
                    │  Shared Package │
                    │                 │
                    │ Protocol / Types│
                    └────────┬────────┘
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
        ┌──────────────┐            ┌──────────────┐
        │   Web App    │            │    Server    │
        │              │            │              │
        │    Next.js   │◄──────────►│ Node + WS    │
        └──────┬───────┘            └──────────────┘
               │
               │
               │ WebRTC
               │
               ▼
        ┌──────────────┐
        │ Other Device │
        └──────────────┘
```

---

# 🛠️ Running the Project Locally

## 1. Requirements

Make sure you have:

* Node.js
* npm
* Git

Check:

```bash
node --version
npm --version
git --version
```

---

# 📥 2. Clone the Repository

Run this from wherever you keep your projects:

```bash
git clone git@github.com:hamzatahir9091/escape-bridge.git
```

Then enter the project:

```bash
cd escape-bridge
```

You should now be at the **project root**:

```text
escape-bridge/
```

You can confirm with:

```bash
pwd
```

---

# 📦 3. Install Dependencies

Run this from the **project root**:

```bash
npm install
```

Do **not** run `npm install` separately inside `apps/web`, `apps/server`, etc.

This project uses npm workspaces, so dependencies are managed from the root.

---

# ⚙️ 4. Environment Variables

The frontend needs to know where the WebSocket server is running.

Create:

```text
apps/web/.env.local
```

For local development:

```env
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

### What does `NEXT_PUBLIC_` mean?

Next.js exposes environment variables beginning with `NEXT_PUBLIC_` to browser-side code.

That's necessary here because the browser needs to know where the signaling server is.

---

# ▶️ 5. Start the Development Environment

From the **project root**:

```bash
npm run dev
```

Turborepo will start the applications together.

Typically:

```text
Web App
http://localhost:3000

Server
ws://localhost:3001
```

Open the frontend:

```text
http://localhost:3000
```

---

# 🧪 Running the Apps Individually

You can also run workspaces independently.

### Web

From the project root:

```bash
npm run dev --workspace=web
```

### Server

From the project root:

```bash
npm run dev --workspace=server
```

This is useful when debugging one side of the application.

---

# 🏗️ Building the Project

Before production deployment, build the workspaces.

From the **project root**:

```bash
npm run build
```

Or build individual workspaces:

```bash
npm run build --workspace=web
```

```bash
npm run build --workspace=server
```

---

# ▶️ Running the Production Build

After building:

```bash
npm run start --workspace=web
```

And for the server:

```bash
npm run start --workspace=server
```

---

# 🌐 Production Environment

The production frontend needs to point to the production WebSocket server.

For example:

```env
NEXT_PUBLIC_WS_URL=wss://your-server-url
```

Notice the difference:

```text
Development
ws://localhost:3001

Production
wss://your-server-url
```

### `ws://` vs `wss://`

* `ws://` → WebSocket without TLS encryption
* `wss://` → secure WebSocket over TLS

If the website is running over HTTPS, production WebSocket connections should normally use `wss://`.

---

# 🔧 Useful Commands

Run commands from the **project root** unless stated otherwise.

### Install dependencies

```bash
npm install
```

### Start everything

```bash
npm run dev
```

### Build everything

```bash
npm run build
```

### Build frontend

```bash
npm run build --workspace=web
```

### Build server

```bash
npm run build --workspace=server
```

### Start frontend

```bash
npm run start --workspace=web
```

### Start server

```bash
npm run start --workspace=server
```

### Check Git status

```bash
git status
```

### Pull latest changes

```bash
git pull origin main
```

---

# 🔄 Getting the Latest Version

If you already cloned the project:

```bash
cd escape-bridge
git pull origin main
```

Then install any newly added dependencies:

```bash
npm install
```

Then start the project:

```bash
npm run dev
```

---

# 🌳 Git Workflow

The main branch is:

```text
main
```

Before making changes:

```bash
git pull origin main
```

Create a feature branch:

```bash
git checkout -b feature/my-feature
```

After making changes:

```bash
git status
git add .
git commit -m "describe your change"
```

Push it:

```bash
git push -u origin feature/my-feature
```

Then merge the feature into `main` through GitHub.

---

# 🧩 Architecture

The project can roughly be divided into four layers:

```text
┌──────────────────────────────┐
│           UI Layer           │
│         Next.js / React      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       Application Logic      │
│     Hooks / State / Utils    │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│       Communication Layer    │
│      WebSocket / WebRTC      │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│        Server / Signaling    │
│       Node.js + WebSocket    │
└──────────────────────────────┘
```

The important architectural idea is:

> **The server helps devices connect; WebRTC handles the actual peer-to-peer communication whenever possible.**

---

# 🔐 Security Philosophy

Escape Bridge is designed around temporary connections.

The long-term goal is:

* No permanent accounts
* No unnecessary user data
* Temporary rooms
* Direct peer-to-peer communication
* End-to-end encryption
* Automatic cleanup

### Current limitation

The initial implementation focuses on getting the networking architecture working first.

Encryption and more advanced file-transfer mechanisms are planned for later versions.

---

# 🚧 Project Status

Escape Bridge is currently an **active development project**.

The core networking architecture is already functional:

```text
✅ WebSocket signaling
✅ Device registration
✅ Rooms
✅ WebRTC connection
✅ Data channels
✅ Text messaging
✅ Multi-device communication
✅ File transfer
✅ Custom device names
🚧 Encryption
🚧 Large-file optimization
🚧 Cloud relay fallback
🚧 QR pairing
```

---

# 🤝 Contributing

Want to experiment with the project?

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Commit your changes
6. Push your branch
7. Open a pull request

Please keep the architecture in mind when adding features.

In particular:

> **Keep signaling separate from peer-to-peer communication whenever possible.**

---

# 📜 License

Add your preferred license here.

---

# 🌉 Final Idea

Escape Bridge started from a very simple question:

> **Why is moving something from one device to another still so annoying?**

We're trying to make that interaction feel like it should have always worked:

```text
Open
  ↓
Connect
  ↓
Send
  ↓
Done.
```

**No accounts. No nonsense. Just a bridge between your devices.**
