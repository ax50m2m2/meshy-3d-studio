# Meshy 3D Studio

AI-assisted 3D asset generation workbench backed by the Meshy API.

## Features
- Text-to-3D and image-to-3D task submission through a server-side API proxy
- Task status polling and model download links
- API key stays on the server via `MESHY_API_KEY`
- Includes deployment notes for a Node.js host

## Setup
1. Install Node.js 18 or later.
2. Run `npm install`.
3. Set `MESHY_API_KEY` in the server environment. Never place the key in browser code or commit it to Git.
4. Run `npm start` and open `http://localhost:8080`.

See `README-DEPLOY.md` for the deployment checklist.

**Important:** Model generation requires an active Meshy API account and API key. API task routes and fields must match the currently enabled Meshy API version in your account.
