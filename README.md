# SSI-FEATURE-PHONE-SIMULATION

## 📄 Overview

---

This repository presents a complete **SSI Feature-Phone Simulation** that integrates both the frontend interfaces and the backend server within a unified codebase.

The system models the core roles of a **Self-Sovereign Identity (SSI) ecosystem**, with a particular focus on the **Issuer–Holder–Verifier** interaction and the lifecycle of a verifiable credential. For the purpose of research and demonstration, the **Bangladesh Election Commission (EC)** and the **Bangladesh Road Transport Authority (BRTA)** are used as illustrative institutional analogues.

Within this simulated environment:

- The **Issuer** demonstrates the process of issuing a **National Identity (NID) verifiable credential** to a citizen (the **Holder**).
- The **Verifier** demonstrates the process of requesting and verifying the authenticity of the Holder’s NID credential.

The use of EC and BRTA in this context is purely conceptual and intended solely to provide a realistic and locally relevant representation of trusted authorities in a national digital identity ecosystem. This project does **not** represent, replicate, or claim any official affiliation with these organizations.

Overall, the implementation provides an end-to-end experimental platform for observing credential issuance, secure holder interaction, and verification workflows in a constrained feature-phone–oriented SSI scenario.

```bash
├── interface
│   ├── holder
│   ├── issuer
│   └── verifier
└── server

Holder Feature-Phone UI: simulates a feature phone with keypad/softkeys, manages offers, wallet, and proof sharing with PIN protection.

Issuer Console (EC): generates invitation codes and issues credentials to connected holders.

Verifier Console (BRTA): generates verifier codes, sends proof requests, and displays received presentations.
```

## 📲 USSD AND PIN

---

```bash
USSD: *567#
PIN: 91563
```

## ⚙️ Prerequisites

---

**Make sure the following tools are installed on your system before running the project locally.**

**🧩 Core Requirements**

```bash
Node.js (version >= 18)
    - Download Node.js from [official_site](https://nodejs.org)
    - LTS (Recommended) ✅ → install this
    - After installtion check the version on PowerShell (node -v)

npm (comes with Node.js)
Git
nodemon (npm install -g nodemon)
```

**📦 Package Manager**

```bash
pnpm (version >= 10)
npm install -g pnpm
```

## 🛠️ Set up and run the interface locally using localhost

---

**1. Clone the Repository**

```bash
git clone https://github.com/RizBits14/ssi-feature-phone-simulation.git
```

**2. Go to each of the interface directory (...ssi-feature-phone-simulation> cd .\interface\)**

**3. Go to each directory and run the commands:**

```bash
npm install
For Example: ...ssi-feature-phone-simulation\interface> cd .\holder\
             ...ssi-feature-phone-simulation\interface\holder> npm install
```

Similarly for issuer and verifier

```bash
Issuer:
...ssi-feature-phone-simulation\interface> cd .\issuer\
...ssi-feature-phone-simulation\interface\issuer> npm install

Verifier:
...ssi-feature-phone-simulation\interface> cd .\verifier\
...ssi-feature-phone-simulation\interface\verifier> npm install
```

### Interface .env configuration

```bash
For interface>issuer, holder and verifier
VITE_API_BASE=<YOUR BACKEND LOCALHOST>
# Typically VITE_API_BASE=http://localhost:3000/
```

### Run locally

Open three different **terminal** or **PowerShell**

```bash
...ssi-feature-phone-simulation> cd .\interface\
...ssi-feature-phone-simulation\interface> cd .\holder\
...ssi-feature-phone-simulation\interface\holder> npm run dev

...ssi-feature-phone-simulation> cd .\interface\
...ssi-feature-phone-simulation\interface> cd .\issuer\
...ssi-feature-phone-simulation\interface\issuer> npm run dev

...ssi-feature-phone-simulation> cd .\interface\
...ssi-feature-phone-simulation\interface> cd .\verifier\
...ssi-feature-phone-simulation\interface\verifier> npm run dev

You will have three different localhost. Typically: **http://localhost:5173**, **http://localhost:5174** and **http://localhost:5175**
```

## 🛠️ Set up and run the server locally using localhost

---

```bash
...ssi-feature-phone-simulation> cd .\server\
...ssi-feature-phone-simulation\server> npm install
```

### Server .env configuration

```bash
DB_USERNAME=<YOUR DATABASE USERNAME>
DB_PASSWORD=<YOUR DATABASE PASSWORD>
DB_NAME=<YOUR DATABASE NAME>
# 1. Signin/Login to Mongodb (https://www.mongodb.com/products/platform/atlas-database) and set it up
# 2. Left side dashboard > Database & Network Access > ADD NEW DATABASE USER
# 3. Fill out the field of Username and Password (create one or generate one (recommended), paste the Username and Password on the .env > Click on Add Built in Role > Atlas admin
# 4. You have your Username and Password, DB_NAME can be set up any name you want

PORT=<YOUR PORT NUMBER>
# Typically PORT=3000

CORS_ORIGIN=<YOUR CORS ORIGIN>
# Typically CORS_ORIGIN=http://localhost:5173/

AES_SECRET=<RANDOM ALPHANUMERIC OF LENGTH 64>
# For Example: A7fK2mP9xQ4Zr8T1bY6Lw3N0cH5UeVdSgJ2oI9aFqR8tM1kXyC4pE7uB6WzD3
```

**After setting the .env variable**

```bash
...ssi-feature-phone-simulation\server> nodemon index.js
Output to expect on the terminal/PowerShell:
MongoDB connected
API listening on port 3000
```

## 🤖 Generate the APK

---

**Must have the Android Studio Software**

```bash
...ssi-feature-phone-simulation\interface\holder> pnpm build
...ssi-feature-phone-simulation\interface\holder> npx cap sync
...ssi-feature-phone-simulation\interface\holder> npx cap open android

The android studio will open. Click on the left corner hamburger > Navigate to Build > Generate App Bundles or APKs

The APK is generally found on android > app > build > outputs > apk > debug

Upload it on Google Drive and Download on any android device
```

## 💡 Brief

---

### Interface

**Phase A** —> Issuer ↔ Holder (Credential Issuance)

**1. Issuer starts a new connection session**

- Issuer opens the Issuer web console.
- Issuer clicks **Generate code.**
- Server creates a new invitation record in MongoDB (`connections` collection)

**2. Holder joins using the invitation code**

- Holder opens the feature-phone app (USSD gate first, then menu).
- Holder goes to **Enter Invite Code** and types the 5-digit code.
- Holder presses **OK**.
- Server verifies the code exists, then generates/assigns a `connectionId`.
- Server updates the connection record
- Issuer console polls `/api/connections`, detects “connected”, and shows the connection is ready.

**3. Issuer issues a credential**

- Issuer fills the claim fields (e.g., name, numeric ID, phone, department/type).
- Issuer clicks **Issue Credential.**
- Server creates a credential document in `credentials` collection and the `claims` stored encrypted **(AES-256-GCM)**
- Issuer UI receives `credentialId` and starts polling for decision (Accepted/Rejected).

**4. Holder receives and decides**

- Holder selects the offered credential and chooses:
  - Accepts -> server updates credential `status: "accepted"`
  - Reject -> server updates credential `status: "rejected"`
- Issuer console polls and displays the final decision (Accepted/Rejected).

**Phase B** —> Verifier ↔ Holder (Proof Request & Presentation)

**5. Verifier starts a new verification connection**

- Verifier opens the Verifier web console.
- Verifier clicks Generate code.
- Server creates another invitation entry in `connections` (same mechanism as issuer side).

**6. Holder joins verifier connection**

- Holder again goes to **Enter Invite Code** and enters the verifier’s 5-digit code.
- Server checks the matching invitation.
- Verifier UI polls `/api/connections` and becomes “Connected”.

**7. Verifier sends proof request**

- Verifier clicks **Send proof request.**
- Server inserts a record into `proof_requests`.
- Verifier UI receives a `proofRequestId` and starts polling for presentation.

**8. Holder responds (send or decline)**

- Holder sees **Proof Requests** and selects one.
- Holder chooses:
  - **Send ->** server fetches the selected accepted credential, decrypts claims, and stores a presentation in `proof_presentations` as `revealed` (decrypted claims)
  - Don’t send → server updates proof request `status: "declined"`
- Verifier polls `/api/presentations`, detects the presentation, and displays verified data.

### Server: Backend API (Node.js + Express + MongoDB)

The `server` contains the single backend service that connects Issuer, Holder, and Verifier into one working SSI simulation. It exposes REST APIs used by all three interfaces and stores all state in MongoDB.

**Core Responsibilities**

- Invitation + Connection Management
  - Generates 5-digit invitation codes
  - Lets holder “connect” by submitting the code
  - Assigns and stores a `connectionId`

- Credential Lifecycle
  - Issuer issues credentials linked to a connectionId
  - Holder can accept or reject the credential
  - Credential state is tracked in MongoDB

- Proof Request & Presentation
  - Verifier sends proof requests to a connected holder
  - Holder can present an accepted credential or decline
  - Presentations are stored and verifiers poll to receive them

- Encryption at Rest (Credentials)
  - Only credential `claims` are encrypted before saving in MongoDB
  - **AES-256-GCM** is used for authenticated encryption
  - Claims are decrypted only when needed for presentation or display

**Main Collections (MongoDB)**

- `connections`
  - Invitations + connection state (`inviteCode`, `connectionId`, `status`)
- `credentials`
  - Issued credentials (`status`, `type`, `encrypted claims`)
- `proof_requests`
  - Verifier requests (`status`, `request`, `connectionId`)
- `proof_presentations`
  - Holder submissions (`revealed`, `credentialId`, `proofRequestId`)

**Key API Endpoints**

`GET /api/health` —> server health check

`POST /api/issuer/create-invitation` —> create 5-digit code

`POST /api/holder/receive-invitation` —> connect holder using code

`POST /api/issuer/issue-credential` —> issue credential (encrypt claims)

`POST /api/holder/accept-credential` —> accept credential

`POST /api/holder/reject-credential` —> reject credential

`POST /api/verifier/send-proof-request` —> create proof request

`POST /api/holder/present-proof` —> decrypt claims and store presentation

`POST /api/holder/decline-proof-request` —> decline proof request

`GET /api/credentials` —> list credentials

`GET /api/proof-requests` —> list proof requests

`GET /api/presentations` —> list presentations

`GET /api/connections` —> list connections

## 📸 Screenshots of the Applications (web version)

---

<img width="1190" height="969" alt="Image" src="https://github.com/user-attachments/assets/831e863c-9299-4d78-83a1-3fd921a3096c" />
<img width="1198" height="1346" alt="Image" src="https://github.com/user-attachments/assets/f42cdb2c-72d7-45f9-ad3a-4bc5e2f277c6" />
<img width="1193" height="967" alt="Image" src="https://github.com/user-attachments/assets/6b425988-8ba4-47a4-96a3-b402ce0de020" />

## 📌 Conclusion

---

This project delivers an end-to-end **SSI Feature-Phone Simulation** of the Issuer–Holder–Verifier workflow, covering invitation-based connection setup, credential issuance, proof requests, and holder-controlled presentation. The **Bangladesh Election Commission (EC)** and **Bangladesh Road Transport Authority (BRTA)** are used **solely as simulated, research-oriented examples** to represent trusted institutions; this work is not affiliated with or endorsed by any official organization.

For improved security in a realistic demonstration setting, the Holder experience includes **PIN-protected actions** (accepting credentials, presenting proofs, and viewing wallet contents), while the backend stores credential claims encrypted at rest using **AES-256-GCM**.

Overall, the repository provides a practical platform for experimentation, evaluation, and future extensions in constrained, feature-phone–oriented SSI scenarios.

## 📞 Contact

---

**Author:** Md. Rizwanul Islam

**Student ID:** 21201129

**Institution** BRAC University

**Email:** mohammad.rizwanul.islam12014@gmail.com

**Feel free to reach out for questions, suggestions, or collaboration regarding this project.**
