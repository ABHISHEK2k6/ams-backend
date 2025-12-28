# Notification API Documentation

Base URL: `/notifications`

## Table of Contents
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get Notifications](#get-notifications)
  - [Create Notification](#create-notification)
  - [Update Notification](#update-notification)
  - [Delete Notification](#delete-notification)
- [Notification Data Model](#notification-data-model)
- [Error Responses](#error-responses)
- [Notes](#notes)

---

## Authentication

All endpoints require authentication via session cookies. Only staff (teacher, principal, hod, staff, admin) can create, update, or delete notifications.

**Middleware Used:**
- `authMiddleware` – Verifies user session ([src/middleware/auth.ts](../../src/middleware/auth.ts))
- `isTeacher` – Restricts certain routes to staff ([src/middleware/roles.ts](../../src/middleware/roles.ts))

---

## Endpoints

### Get Notifications

Retrieve notifications relevant to the authenticated user.

**Endpoint:** `GET /notifications`

**Authentication:** Required

**Response Codes:**
- `200` – Success
- `404` – User or role instance not found

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Successfully fetched college, year, department and batch notifications for student",
  "data": {
    "notifications": [
      {
        "_id": "notification_id",
        "targetGroup": "year",
        "targetID": "2024",
        "targetUsers": ["student"],
        "title": "Exam Schedule",
        "message": "Midterm exams start next week.",
        "priorityLevel": "High",
        "Notificationtype": "announcement"
      }
    ]
  }
}
```

---

### Create Notification

Create a new notification. Only staff can create notifications.

**Endpoint:** `POST /notifications`

**Authentication:** Required (Staff only)

**Request Body:**
```json
{
  "targetGroup": "college | year | batch | department",
  "targetID": "null if targetGroup is college, 'all' if targetUsers includes parent, teacher, or staff, otherwise a specific string",
  "targetUsers": ["student" | "staff" | "parent"],
  "title": "string (min 3 chars)",
  "message": "string",
  "priorityLevel": "High | Medium | Low",
  "notificationType": "announcement | info | results"
}
```
**Rules:**
- If `targetGroup` is `"college"`, then `targetID` **must be** `null`.
- If `targetUsers` includes `"parent"`, `"teacher"`, or `"staff"`, then `targetID` **must be** `"all"`.

**Response Example:**
```json
{
  "status_code": 201,
  "message": "successfully created the notification",
  "data": ""
}
```

**Response Codes:**
- `201` – Created
- `403` – Forbidden (insufficient role)
- `404` – User not found

---

### Update Notification

Update an existing notification by ID. Only staff can update notifications.

**Endpoint:** `PUT /notifications/:id`

**Authentication:** Required (Staff only)

**Parameters:**
- `id` (path) – Notification ID

**Request Body:** (Any updatable fields)
```json
{
  "targetGroup": "college | year | batch | department",
  "targetID": "null if targetGroup is college, 'all' if targetUsers includes parent, teacher, or staff, otherwise a specific string",
  "targetUsers": ["student" | "staff" | "parent"],
  "title": "string",
  "message": "string",
  "priorityLevel": "High | Medium | Low",
  "notificationType": "announcement | info | results"
}
```
**Rules:**
- If `targetGroup` is `"college"`, then `targetID` **must be** `null`.
- If `targetUsers` includes `"parent"`, `"teacher"`, or `"staff"`, then `targetID` **must be** `"all"`.

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Successfully updated the notification",
  "data": {
    "notification": {
      "_id": "notification_id",
      "title": "Updated Title"
    }
  }
}
```

**Response Codes:**
- `200` – Updated
- `404` – Notification not found

---

### Delete Notification

Delete a notification by ID. Only staff can delete notifications.

**Endpoint:** `DELETE /notifications/:id`

**Authentication:** Required (Staff only)

**Parameters:**
- `id` (path) – Notification ID

**Response Example:**
```json
{
  "status_code": 204,
  "message": "Successfully deleted the notification",
  "data": ""
}
```

**Response Codes:**
- `204` – Deleted
- `404` – Notification not found

---

## Notification Data Model

- `targetGroup`: `"college" | "year" | "batch" | "department"`
- `targetID`: 
  - `null` if `targetGroup` is `"college"`
  - `"all"` if `targetUsers` includes `"parent"`, `"teacher"`, or `"staff"`
  - Otherwise, a specific string
- `targetUsers`: `string[]` (e.g., `["student"]`, `["staff"]`, `["parent"]`)
- `title`: `string`
- `message`: `string`
- `priorityLevel`: `"High" | "Medium" | "Low"`
- `notificationType`: `"announcement" | "info" | "results"`

---

## Error Responses

**401 Unauthorized:**
```json
{
  "status": 401,
  "message": "Unauthorized - Invalid or expired session"
}
```

**403 Forbidden:**
```json
{
  "status_code": 403,
  "message": "User Request Forbidden , Since You are Not a Staff",
  "data": ""
}
```

**404 Not Found:**
```json
{
  "status_code": 404,
  "message": "User not found",
  "data": ""
}
```

---

## Notes

- Only staff (teacher, principal, hod, staff, admin) can create, update, or delete notifications.
- Students and parents can only fetch notifications relevant to them.
- The `targetGroup` and `targetID` fields determine the audience for the notification.
- Use session cookies for authentication on all requests.
- **Special Rules:**  
  - If `targetGroup` is `"college"`, set `targetID` to `null`.  
  - If `targetUsers` includes `"parent"`, `"teacher"`, or `"staff"`, set `targetID` to `"all"`.

---