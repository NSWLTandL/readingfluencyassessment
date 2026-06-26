# KS3 Reading Fluency Assessment

A simple, tablet-friendly website that lets a teacher record a reading fluency
assessment for a student and save the result into an Excel table in your school's
OneDrive / SharePoint.

When the assessor marks an item **Challenging**, practical advice appears
immediately on screen. On submit, the result is saved as one row in Excel, with
**Fluent** cells coloured green and **Challenging** cells coloured red.

---

## How it works (Option A — the version built here)

```
  Teacher's tablet
        |
        |  (1) fills in the form, taps Submit
        v
  Cloudflare Pages  ............  hosts index.html / styles.css / script.js
        |
        |  (2) sends the result as JSON
        v
  Cloudflare Worker  ...........  worker.js  (validates, hides the secret URL)
        |
        |  (3) POSTs the JSON to a private webhook
        v
  Power Automate flow  .........  "When an HTTP request is received"
        |
        |  (4) adds one row
        v
  Excel table in SharePoint / OneDrive
```

The website never knows the Power Automate address. That address lives only inside
the Worker, stored as an encrypted secret called `POWER_AUTOMATE_WEBHOOK_URL`.

---

## Folder structure

```
reading-fluency-app/
├── index.html                     Front-end form (Cloudflare Pages)
├── styles.css                     Styling
├── script.js                      Front-end logic + advice bank
├── worker.js                      Cloudflare Worker (secure bridge)
├── wrangler.toml                  Worker configuration
├── README.md                      This file
└── sample-assessment-results.xlsx Ready-made Excel table with colour coding
```

---

## Setup — do these in order

You will need: the GitHub repo, a Cloudflare account, and a Microsoft 365 account
with permission to create Power Automate flows.

### Step 1 — Put the files on GitHub

Easiest method (no command line):

1. Go to your repository on GitHub.
2. Click **Add file ▸ Upload files**.
3. Drag in all the files from this folder.
4. Add a short message like "initial upload" and click **Commit changes**.

### Step 2 — Create the Excel spreadsheet in OneDrive / SharePoint

1. Upload `sample-assessment-results.xlsx` to OneDrive (or a SharePoint document
   library) — for example into a folder called **Reading Fluency**.
2. Open it in Excel for the web. It already contains a table called **Assessments**
   with the correct columns and the green/red colour coding. The two example rows
   can be deleted once you have tested everything.

> If you would rather build the table from scratch, see
> **"Creating the Excel table manually"** near the bottom.

The 11 columns are:

```
Timestamp · StudentName · TutorGroup · Assessor · TrickyWords ·
SplitDigraphs · ComplexGraphemes · PolysyllabicWords · Morphology ·
Prosody · AdviceGenerated
```

### Step 3 — Build the Power Automate flow

1. Go to **make.powerautomate.com** and sign in with the school account.
2. Click **Create ▸ Automated cloud flow ▸ Skip** (or **Instant cloud flow**).
   Search the triggers for **"When a HTTP request is received"** and add it.
3. In that trigger, set **Request Body JSON Schema**. Click **Use sample payload to
   generate schema** and paste this in:

   ```json
   {
     "Timestamp": "2025-09-01T09:15:00Z",
     "TimestampReadable": "01 Sep 2025, 09:15",
     "StudentName": "Example Student",
     "TutorGroup": "7A",
     "Assessor": "Ms Taylor",
     "TrickyWords": "Fluent",
     "SplitDigraphs": "Fluent",
     "ComplexGraphemes": "Challenging",
     "PolysyllabicWords": "Not assessed",
     "Morphology": "Fluent",
     "Prosody": "Challenging",
     "AdviceGenerated": "Some combined advice text"
   }
   ```

4. Add a new step: **Excel Online (Business) ▸ Add a row into a table**.
   - **Location**: OneDrive for Business (or the SharePoint site).
   - **Document Library** / **File**: pick `sample-assessment-results.xlsx`.
   - **Table**: choose **Assessments**.
   - For each column, click the box and insert the matching field from the trigger
     (StudentName → StudentName, and so on). Use **Timestamp** for the Timestamp
     column.
5. Click **Save**.
6. Open the trigger step again — Power Automate has now generated the
   **HTTP POST URL**. Copy it. **This is your secret webhook URL.**

### Step 4 — Deploy the Cloudflare Worker

You can do this from your own computer with Node.js installed.

```bash
# 1. Get the code (or just open the folder you uploaded)
git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>

# 2. Log in to Cloudflare
npx wrangler login

# 3. Add the secret (paste the Power Automate URL when prompted)
npx wrangler secret put POWER_AUTOMATE_WEBHOOK_URL

# 4. Deploy
npx wrangler deploy
```

After deploy, Wrangler prints your Worker URL, e.g.
`https://reading-fluency-worker.your-name.workers.dev`. **Copy it.**

### Step 5 — Point the website at the Worker

1. Open `script.js`.
2. Near the top, set `WORKER_URL` to the URL from Step 4:

   ```js
   const WORKER_URL = "https://reading-fluency-worker.your-name.workers.dev";
   ```

3. Commit the change to GitHub (Step 1 method, or `git push`).

### Step 6 — Deploy the front-end on Cloudflare Pages

1. In the Cloudflare dashboard go to **Workers & Pages ▸ Create ▸ Pages ▸
   Connect to Git**.
2. Choose your repository.
3. Build settings: leave the build command **empty** and set the
   **output / root directory** to `/` (the site is plain HTML — no build needed).
4. Click **Save and Deploy**. You will get a URL like
   `https://reading-fluency.pages.dev`.

### Step 7 — Test it

1. Open the Pages URL on a computer or tablet.
2. Enter a student name, tutor group and assessor name.
3. Tap some green and red circles — advice should appear under each red one.
4. Tap **Submit assessment**. You should see the green confirmation tick.
5. Open the Excel file in OneDrive — a new row should be there, with Fluent cells
   green and Challenging cells red.

---

## Conditional formatting in Excel Online (already set up, but here's how)

The supplied file already colours the six assessment columns. To set it up yourself
on a fresh sheet:

1. Select the cells under the six assessment columns
   (**TrickyWords** to **Prosody**) — for example `E2:J1000`.
2. On the **Home** tab choose **Conditional Formatting ▸ New Rule**.
3. Choose **Format only cells that contain**.
4. Set: **Cell Value** ▸ **equal to** ▸ type `Fluent`.
5. Click **Format**, choose a **green** fill, click **OK**, then **OK** again.
6. Repeat steps 2–5 with `Challenging` and a **red** fill.
7. Leave **Not assessed** with no rule so it stays neutral/white.

> Tip: type the words exactly — `Fluent`, `Challenging`, `Not assessed` — with the
> same capitalisation the app uses, or the colours won't trigger.

---

## Connecting it all together (summary)

| Piece | Knows the secret URL? | Where the URL is stored |
|-------|----------------------|-------------------------|
| Website (`script.js`) | No | Only knows the **Worker** URL |
| Worker (`worker.js`)  | Yes | Cloudflare **secret** `POWER_AUTOMATE_WEBHOOK_URL` |
| Power Automate        | n/a | It *is* the URL |

---

## Option B — More technical (Worker writes directly to Microsoft Graph)

This skips Power Automate entirely. It is more powerful but needs an IT
administrator, so Option A above is recommended for most schools.

**What you would need:**

1. **Azure App Registration** (in Microsoft Entra ID / Azure AD):
   - Register a new application.
   - Under **API permissions**, add **Microsoft Graph ▸ Application permissions ▸
     `Files.ReadWrite.All`** (or `Sites.ReadWrite.All` for SharePoint), then click
     **Grant admin consent**.
   - Under **Certificates & secrets**, create a **client secret** and copy it.
   - Note the **Application (client) ID** and **Directory (tenant) ID**.

2. **Worker environment variables / secrets** (added with `wrangler secret put`):
   - `GRAPH_TENANT_ID`
   - `GRAPH_CLIENT_ID`
   - `GRAPH_CLIENT_SECRET`
   - `GRAPH_DRIVE_ID` (the drive containing the workbook)
   - `GRAPH_ITEM_ID` (the workbook's file ID)

3. **What the Worker would do instead of calling Power Automate:**
   - Request an OAuth token from
     `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
     using the client credentials grant and scope
     `https://graph.microsoft.com/.default`.
   - Call
     `POST https://graph.microsoft.com/v1.0/drives/{DRIVE_ID}/items/{ITEM_ID}/workbook/tables/Assessments/rows`
     with the row values, sending the token as a `Bearer` header.

Because it requires admin consent and app credentials, only pursue Option B if your
IT team is comfortable managing an Azure app registration. **This project ships with
Option A built and ready.**

---

## Creating the Excel table manually (if you don't use the supplied file)

1. Open a blank workbook in Excel Online.
2. In row 1, type the 11 column names exactly as listed above (one per cell, A–K).
3. Select `A1:K1`, then **Home ▸ Format as Table** and tick **My table has headers**.
4. With the table selected, open **Table Design** and set the **Table Name** to
   **Assessments**.
5. Apply the conditional formatting described above.

---

## Common problems and fixes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Submit button stays greyed out | Name, tutor group or assessor is blank | Fill in all three text boxes |
| "Could not save the assessment" message | `WORKER_URL` in `script.js` is wrong or still says `REPLACE-ME` | Paste the real Worker URL and re-deploy Pages |
| Worker returns *"POWER_AUTOMATE_WEBHOOK_URL is missing"* | Secret not added | Run `npx wrangler secret put POWER_AUTOMATE_WEBHOOK_URL` then `npx wrangler deploy` |
| Worker returns a 502 / "Power Automate rejected" | Flow URL is wrong, or the flow is turned off | Re-copy the HTTP POST URL from the trigger; make sure the flow is **On** |
| No new row in Excel | Column names in the flow don't match the table | Check each field maps to the matching column; table must be named **Assessments** |
| Colours don't appear in Excel | Text doesn't match the rule exactly | Values must be exactly `Fluent` / `Challenging`; re-check the conditional formatting rules |
| Browser console shows a CORS error | Origin blocked | In `worker.js` you can set `ALLOWED_ORIGIN` to your exact Pages URL, then re-deploy |
| Date/time looks wrong | Browser/locale difference | The displayed time uses the tablet's clock; the saved `Timestamp` is standard UTC (ISO format) |

---

## Notes

- This stores ordinary assessment data. Follow your school's data-protection
  policy for pupil information, and keep the Excel file inside the school tenant.
- To lock the website down to staff only, host the Pages site behind
  **Cloudflare Access** (Zero Trust) so only signed-in school accounts can open it.
