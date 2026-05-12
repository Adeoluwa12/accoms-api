# ACCOMS — Event Accommodation Management System

Production-ready REST API backend built with **Express.js + MongoDB (Mongoose)**.

## Quick Start

```bash
cp .env.example .env        # Set MONGODB_URI
npm install
npm run dev                 # nodemon, hot reload
# or
npm start                   # production
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/accoms` | MongoDB connection string |
| `NODE_ENV` | `development` | Environment |

---

## API Reference

Base URL: `http://localhost:5000/api`

All responses follow this shape:
```json
{ "success": true, "data": { ... } }
{ "success": false, "message": "...", "code": "ERROR_CODE" }
```

---

### EVENTS

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/events` | Create event |
| `GET` | `/events` | List all events (with registered/present counts) |
| `PATCH` | `/events/:id/activate` | Set as active event |
| `DELETE` | `/events/:id` | Delete event (cascades attendees + units) |

**POST /events body:**
```json
{
  "name": "Annual Conference 2025",
  "venue": "Grace Hall, Ibadan",
  "startDate": "2025-08-01",
  "endDate": "2025-08-03"
}
```

---

### ATTENDEES

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/attendees` | Add single attendee |
| `POST` | `/attendees/import` | Bulk import (JSON array) |
| `POST` | `/attendees/import-workers` | Bulk import workers (forces `isWorker: true`) |
| `GET` | `/attendees` | List with filters + pagination |
| `POST` | `/attendees/:id/checkin` | Check in + auto-assign room |
| `POST` | `/attendees/:id/undo` | Undo check-in (releases slot) |
| `POST` | `/attendees/:id/assign` | Manual assign to specific unit |
| `DELETE` | `/attendees/:id` | Delete (releases slot) |

**POST /attendees body:**
```json
{
  "eventId": "...",
  "firstName": "Seun",
  "surname": "Adeyemi",
  "gender": "Male",
  "churchCenter": "Ibadan",
  "fellowship": "Agbo",
  "isWorker": false,
  "workerRole": "Usher",
  "badgeMode": "digital"
}
```

**GET /attendees query params:**
- `eventId` — filter by event (recommended)
- `search` — full-text search (name, fellowship, churchCenter)
- `gender` — `Male` | `Female`
- `present` — `true` | `false`
- `assigned` — `true` | `false`
- `page`, `limit` — pagination (default 1, 50)

**POST /attendees/import body:**
```json
{
  "eventId": "...",
  "attendees": [
    {
      "firstName": "Tolu",
      "surname": "Bello",
      "gender": "Female",
      "churchCenter": "Lagos",
      "fellowship": "Song",
      "isWorker": true,
      "workerRole": "Technical"
    }
  ]
}
```

`POST /attendees/import-workers` body:
```json
{
  "eventId": "...",
  "attendees": [
    { "firstName": "Ife", "surname": "Akin", "gender": "Female", "workerRole": "Welfare" }
  ]
}
```
This endpoint is the same as `/attendees/import`, but it forces `isWorker: true` for every imported row (so `isWorker` / `is_worker` column is not required in a workers CSV).

**POST /attendees/:id/assign body:**
```json
{ "unitId": "...", "useReserved": false }
```
Set `useReserved: true` to bypass reserved slot buffer.

---

### ACCOMMODATION UNITS

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/units` | Create unit |
| `GET` | `/units` | List units (with occupants) |
| `GET` | `/units/:id` | Unit detail with occupant list |
| `PATCH` | `/units/:id` | Update name/capacity/reservedSlots |
| `PATCH` | `/units/:id/toggle` | Activate / deactivate |
| `POST` | `/units/:id/leader` | Set or clear room leader |
| `POST` | `/units/:id/reserved-assign` | Assign attendee into reserved slot |

**POST /units body:**
```json
{
  "eventId": "...",
  "name": "Room A1",
  "gender": "Male",
  "type": "Room",
  "capacity": 6,
  "reservedSlots": 1
}
```

**POST /units/:id/leader body:**
```json
{ "attendeeId": "..." }   // null to clear
```

---

### DASHBOARD

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/active-event` | Active event info |
| `GET` | `/dashboard/stats?eventId=` | Core stats (registered, present, etc.) |
| `GET` | `/dashboard/occupancy?eventId=&type=` | All unit occupancy bars |
| `GET` | `/dashboard/distribution?eventId=` | Church center + fellowship breakdown |

---

### REPORTS

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reports/attendance?eventId=` | Full attendance sheet |
| `GET` | `/reports/room-manifest?eventId=` | Each unit with occupant list |
| `GET` | `/reports/unassigned?eventId=` | Checked-in but not yet assigned |

**attendance query params:** `gender`, `present` (`true`/`false`)

---

## Smart Distribution Algorithm

When auto-assigning a room at check-in, the system scores every available unit:

```
score = (# same churchCenter in unit × 2) + (# same fellowship in unit × 3)
```

The unit with the **lowest score** is chosen — meaning attendees are spread across rooms, avoiding clusters of people who already know each other. Fellowship is weighted higher because it's a tighter social circle.

**Priority:** Rooms → Dorms. If all full, returns a `NO_CAPACITY` error so the admin can add capacity manually.

---

## Project Structure

```
src/
  app.js                     # Entry point
  config/
    db.js                    # MongoDB connection
  models/
    Event.js
    Unit.js
    Attendee.js
  controllers/
    event.controller.js
    attendee.controller.js
    unit.controller.js
    dashboard.controller.js
    report.controller.js
  services/
    allocation.service.js    # Core scoring + assignment logic
  routes/
    index.js
  middleware/
    errorHandler.js
```
