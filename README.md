# Traqspera — Time Hour Rules Prototype

Interactive React prototype reconstructed from the Figma Make file `Time Hour Rules.make`, styled with **Trimble Modus Web Components**.

## Live demo

GitHub Pages: https://sarafarhat13.github.io/traqspera-time-hour-rules/

## Run locally

```bash
cd prototype
npm install
npm run dev
```

## Stack

- React 19 + Vite + TypeScript + Tailwind CSS
- [@trimble-oss/moduswebcomponents](https://github.com/trimble-oss/modus-wc-2.0) + React wrappers (`ModusWcButton`, `ModusWcSwitch`, `ModusWcCheckbox`, `ModusWcTabs`, `ModusWcAlert`, `ModusWcBadge`)

## What's included

- **Settings → Hour Rules** — Company / Union / State hour rules, meal periods, breaks, premiums, exclusions, autosave
- **Time → Clock In and Out** — Clock UI with status, breaks, attestation
- **Time → Compliance Dashboard** — Exception dashboard with filters and Modus Send Alert actions
