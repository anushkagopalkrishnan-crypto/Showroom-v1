# Showroom

Showroom turns a prospect's help content, discovery notes and capabilities list
into a short, narrated demo video, then drafts the follow-up from the buyer's
reply. This branch (`talkdesk-branding`) adds Talkdesk branding to the videos and
restyles the app with the Cobalt design system.

> Prototype. Use synthetic data only. Do not enter real customer or prospect data.

## What this branch adds

- **Talkdesk intro and ending clips** play before and after every generated video, in
  the in-app player and in the exported file (`public/brand/`, configured in
  `src/utils/brandClips.ts`).
- **Cobalt styling** for the app UI and the video scenes (Talkdesk Purple, Deep
  Purple, Roboto, Cobalt radii and shadows). Tokens live in `src/index.css`.
- **No brand colour input.** Videos always use Talkdesk Purple.
- Gemini prompts ask for Cobalt-style copy (sentence case, present tense, concise).

## Run it locally

You need Node.js 20 or later and a Gemini API key from
[Google AI Studio](https://aistudio.google.com/apikey). Each person uses their own
key. Never commit it.

```bash
git clone -b talkdesk-branding https://github.com/anushkagopalkrishnan-crypto/Showroom-v1.git
cd Showroom-v1
npm install
echo 'GEMINI_API_KEY="your key here"' > .env
npm run dev
```

Open http://localhost:3000, click **Load synthetic example**, then **Build storyboard**.
A build can take one to two minutes. Then open the **Video** tab and press **Play**.

The `.env` file is ignored by git.

## Troubleshooting

- **"fetch failed" when building a storyboard.** On a company network that
  re-signs HTTPS traffic, Node may not trust the certificate. Start the app with your
  company's CA bundle:
  ```bash
  NODE_EXTRA_CA_CERTS=/path/to/company-ca-bundle.pem npm run dev
  ```
- **"API key not valid".** The value in `.env` must be the API key itself, not the
  Google Cloud project ID (`gen-lang-client-…`).
- **"High demand" errors from Gemini.** These are temporary. Try again in a minute.
- **Port 3000 is in use.** Run `PORT=3100 npm run dev`.

## Notes for developers

- Video visuals are drawn twice: React in `src/components/VideoTab.tsx` (player) and
  canvas in `src/utils/videoExporter.ts` (downloaded file). Change both together.
- `.npmrc` sets `legacy-peer-deps=true` because the `esbuild` version pinned in
  `package.json` conflicts with Vite's optional peer range.
- Colour values come from the Talkdesk Brand Guidelines; hover, neutral text and
  error/warning/success shades are approximations until swapped for the Figma
  Cobalt variables.
- Checks: `npm run lint` (type check) and `npx tsx --test src/utils/showroomLogic.test.ts`.
