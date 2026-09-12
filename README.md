# Campus Event Manager

A small MongoDB-backed web application for managing university events, users and
registrations. Built as a NoSQL Development Project (MCS DE1) — this application
replaces the final written exam.

## 1\. Purpose

The university needs a lightweight tool to manage campus events (workshops, talks,
meetups, hackathons, student activities), including who organizes them and who is
registered to attend.

## 2\. Technology used

* **Database:** MongoDB (native `mongodb` Node.js driver)
* **Backend:** Node.js + Express
* **Views:** EJS (server-side templates) + Bootstrap 5
* **Other:** dotenv, method-override

## 3\. Install dependencies

```bash
npm install
```

## 4\. Configure the MongoDB connection

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

```
MONGODB\_URI=mongodb://localhost:27017
DB\_NAME=campus\_events
PORT=3000
```

Use a MongoDB Atlas connection string in `MONGODB\_URI` if you prefer a cloud instance.
**Never commit your real `.env` file** — it is already listed in `.gitignore`.

## 5\. Initialize and seed the database

```bash
npm run init   # creates collections with validation + indexes
npm run seed   # inserts 15 users, 18 events, 40+ registrations
```

`npm run seed` can be re-run at any time: it clears the `users` and `events`
collections first, so the data stays reproducible.

## 6\. Run the application

```bash
npm start
```

Then open http://localhost:3000

## 7\. Main application pages

|Page|Route|Description|
|-|-|-|
|Dashboard|`/`|KPI cards, next 5 upcoming events, most popular event|
|Events|`/events`|Event catalog: search, filter, sort, create/edit/delete|
|Event details|`/events/:id`|Full event info + registration management|
|Users|`/users`|User directory: search, filter, create/edit/delete|
|User details|`/users/:id`|Participation history (upcoming/past)|
|Analytics|`/analytics`|6 aggregation-based analyses (A to F)|

## 8\. Author

Zaineb Triki

## Notes on data model

* `location` is embedded inside each event document (building, room, campus).
* `tags` is an array of strings on each event.
* `registrations` is an array of embedded sub-documents (`userId`, `registeredAt`, `status`).
* Events reference their organizer via `organizerId`, and each registration references a
user via `userId` — see `report/report.docx` for the full embedding-vs-referencing rationale.

