# Attendance Session API Documentation

Base URL: `/attendance/session`

## Table of Contents
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [List Attendance Sessions](#list-attendance-sessions)
  - [Get Unique Sessions for Current User](#get-unique-sessions-for-current-user)
  - [Get Attendance Session](#get-attendance-session)
  - [Create Attendance Session](#create-attendance-session)
  - [Update Attendance Session](#update-attendance-session)
  - [Delete Attendance Session](#delete-attendance-session)
- [Data Model](#data-model)
- [Error Responses](#error-responses)
- [Notes](#notes)

---

## Authentication

All endpoints require authentication via session cookies. Only staff members (teacher, hod, principal, staff, admin) can access these endpoints.

**Middleware Used:**
- `authMiddleware` – Verifies user session ([src/middleware/auth.ts](../../src/middleware/auth.ts))
- `isAnyStaff` – Restricts routes to staff members ([src/middleware/roles.ts](../../src/middleware/roles.ts))

---

## Endpoints

### List Attendance Sessions

Retrieve a paginated list of attendance sessions with optional filtering.

**Endpoint:** `GET /attendance/session`

**Authentication:** Required (Staff only)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (minimum: 1) |
| `limit` | number | No | 10 | Items per page (minimum: 1, maximum: 100) |
| `batch` | string | No | - | Filter by batch ID |
| `subject` | string | No | - | Filter by subject ID |
| `session_type` | string | No | - | Filter by type: `regular`, `extra`, or `practical` |
| `from_date` | string | No | - | Filter sessions from this date (format: YYYY-MM-DD) |
| `to_date` | string | No | - | Filter sessions until this date (format: YYYY-MM-DD) |

**Response Codes:**
- `200` – Success
- `401` – Unauthorized
- `403` – Forbidden (not a staff member)
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance sessions fetched successfully",
  "data": {
    "sessions": [
      {
        "_id": "session_id_1",
        "batch": "batch_id",
          "name": "CSE 2024-A",
          "code": "CSE24A",
          "year": 2024
        },
        "subject": {
          "_id": "subject_id",
          "name": "Data Structures",
          "code": "CS201"
        },
        "created_by": {
          "_id": "teacher_id",
          "user": {
            "name": "Dr. Jane Smith",
            "email": "jane.smith@uck.ac.in",
            "first_name": "Jane",
            "last_name": "Smith"
          }
        },
        "start_time": "2026-01-21T09:00:00.000Z",
        "end_time": "2026-01-21T10:30:00.000Z",
        "hours_taken": 1.5,
        "session_type": "regular",
        "createdAt": "2026-01-21T08:00:00.000Z",
        "updatedAt": "2026-01-21T08:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

---

### Get Unique Sessions for Current User

Retrieve unique batch-subject combinations for attendance sessions created by the authenticated user. This endpoint aggregates sessions to show distinct batch-subject pairs, along with the count of sessions and the most recent session date for each combination.

**Endpoint:** `GET /attendance/session/recent`

**Authentication:** Required (Staff only)

**Query Parameters:** None

**Response Codes:**
- `200` – Success
- `401` – Unauthorized
- `403` – Forbidden (not a staff member)
- `404` – Teacher profile not found
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Recent sessions fetched successfully",
  "data": [
    {
      "batch": {
        "_id": "batch_id_1",
        "name": "CSE 2024-A",
        "code": "CSE24A",
        "year": 2024
      },
      "subject": {
        "_id": "subject_id_1",
        "name": "Data Structures",
        "code": "CS201"
      },
      "sessionCount": 15,
      "latestSession": "2026-03-05T10:30:00.000Z"
    },
    {
      "batch": {
        "_id": "batch_id_1",
        "name": "CSE 2024-A",
        "code": "CSE24A",
        "year": 2024
      },
      "subject": {
        "_id": "subject_id_2",
        "name": "Algorithms",
        "code": "CS301"
      },
      "sessionCount": 12,
      "latestSession": "2026-03-04T14:00:00.000Z"
    },
    {
      "batch": {
        "_id": "batch_id_2",
        "name": "CSE 2024-B",
        "code": "CSE24B",
        "year": 2024
      },
      "subject": {
        "_id": "subject_id_1",
        "name": "Data Structures",
        "code": "CS201"
      },
      "sessionCount": 10,
      "latestSession": "2026-03-03T09:00:00.000Z"
    }
  ]
}
```

**Usage:**
This endpoint is useful for:
- Displaying a teacher's teaching assignments
- Showing summary of classes taught by a teacher
- Filtering or grouping attendance records by the combinations a teacher has taught
- Dashboard widgets showing active batch-subject combinations

**Notes:**
- Results are sorted by `latestSession` in descending order (most recent first)
- Only sessions created by the authenticated user are included
- The `sessionCount` field indicates how many sessions exist for each batch-subject combination
- If a batch or subject has been deleted, those fields may be empty in the response

---

### Get Attendance Session

Retrieve details of a specific attendance session.

**Endpoint:** `GET /attendance/session/:id`

**Authentication:** Required (Staff only)

**Path Parameters:**
- `id` (required) - Attendance session ID

**Response Codes:**
- `200` – Success
- `404` – Session not found
- `401` – Unauthorized
- `403` – Forbidden
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance session fetched successfully",
  "data": {
    "_id": "session_id",
    "batch": {
      "_id": "batch_id",
      "name": "CSE 2024-A",
      "code": "CSE24A",
      "year": 2024
    },
    "subject": {
      "_id": "subject_id",
      "name": "Data Structures",
      "code": "CS201"
    },
    "created_by": {
      "_id": "teacher_id",
      "user": {
        "name": "Dr. Jane Smith",
        "email": "jane.smith@uck.ac.in",
        "first_name": "Jane",
        "last_name": "Smith"
      }
    },
    "start_time": "2026-01-21T09:00:00.000Z",
    "end_time": "2026-01-21T10:30:00.000Z",
    "hours_taken": 1.5,
    "session_type": "regular",
    "createdAt": "2026-01-21T08:00:00.000Z",
    "updatedAt": "2026-01-21T08:00:00.000Z"
  }
}
```

---

### Create Attendance Session

Create a new attendance session. The `created_by` field is automatically set to the authenticated user (staff role).

**Endpoint:** `POST /attendance/session`

**Authentication:** Required (Staff only)

**Request Body:**
```json
{
  "batch": "batch_id",
  "subject": "subject_id",
  "start_time": "2026-01-21T09:00:00.000Z",
  "end_time": "2026-01-21T10:30:00.000Z",
  "hours_taken": 1.5,
  "session_type": "regular"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batch` | string | Yes | Batch ID (references Batch model) |
| `subject` | string | Yes | Subject ID (references Subject model) |
| `start_time` | string | Yes | Session start time (ISO 8601 format) |
| `end_time` | string | Yes | Session end time (ISO 8601 format) |
| `hours_taken` | number | Yes | Duration in hours (minimum: 0) |
| `session_type` | string | Yes | Type: `regular`, `extra`, or `practical` |

**Response Codes:**
- `201` – Created
- `400` – Invalid request body
- `404` – Authenticated user profile not found
- `401` – Unauthorized
- `403` – Forbidden
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 201,
  "message": "Attendance session created successfully",
  "data": {
    "_id": "new_session_id",
    "batch": "batch_id",
    "subject": "subject_id",
    "created_by": "teacher_id",
    "start_time": "2026-01-21T09:00:00.000Z",
    "end_time": "2026-01-21T10:30:00.000Z",
    "hours_taken": 1.5,
    "session_type": "regular",
    "createdAt": "2026-01-21T08:00:00.000Z",
    "updatedAt": "2026-01-21T08:00:00.000Z"
  }
}
```

---

### Update Attendance Session

Update an existing attendance session. Only the session creator or admin/principal/hod can update.

**Endpoint:** `PUT /attendance/session/:id`

**Authentication:** Required (Staff only)

**Path Parameters:**
- `id` (required) - Attendance session ID

**Authorization:**
- Session creator can update their own sessions
- Admin, Principal, or HOD can update any session

**Request Body:**
All fields are optional. Only include fields you want to update.

```json
{
  "batch": "batch_id",
  "subject": "subject_id",
  "start_time": "2026-01-21T09:00:00.000Z",
  "end_time": "2026-01-21T10:30:00.000Z",
  "hours_taken": 1.5,
  "session_type": "practical"
}
```

**Response Codes:**
- `200` – Updated successfully
- `400` – Invalid request body
- `404` – Session not found
- `403` – Forbidden (not authorized to update this session)
- `401` – Unauthorized
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance session updated successfully",
  "data": {
    "_id": "session_id",
    "batch": {
      "_id": "batch_id",
      "name": "CSE 2024-A",
      "code": "CSE24A",
      "year": 2024
    },
    "subject": {
      "_id": "subject_id",
      "name": "Data Structures",
      "code": "CS201"
    },
    "created_by": {
      "_id": "teacher_id",
      "user": {
        "name": "Dr. Jane Smith",
        "email": "jane.smith@uck.ac.in"
      }
    },
    "start_time": "2026-01-21T09:00:00.000Z",
    "end_time": "2026-01-21T10:30:00.000Z",
    "hours_taken": 1.5,
    "session_type": "practical",
    "createdAt": "2026-01-21T08:00:00.000Z",
    "updatedAt": "2026-01-21T09:00:00.000Z"
  }
}
```

---

### Delete Attendance Session

Delete an attendance session. Only the session creator or admin/principal/hod can delete.

**Endpoint:** `DELETE /attendance/session/:id`

**Authentication:** Required (Staff only)

**Path Parameters:**
- `id` (required) - Attendance session ID

**Authorization:**
- Session creator can delete their own sessions
- Admin, Principal, or HOD can delete any session

**Response Codes:**
- `200` – Deleted successfully
- `404` – Session not found
- `403` – Forbidden (not authorized to delete this session)
- `401` – Unauthorized
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance session deleted successfully",
  "data": ""
}
```

---

## Data Model

The `AttendanceSession` model represents a class session for tracking attendance.

### Schema

```typescript
{
  _id: string,
  batch: ObjectId,              // References Batch model
  subject: ObjectId,            // References Subject model
  created_by: ObjectId,         // References User model
  start_time: Date,             // Session start time
  end_time: Date,               // Session end time
  hours_taken: number,          // Duration in hours
  session_type: string,         // "regular" | "extra" | "practical"
  createdAt: Date,              // Record creation timestamp
  updatedAt: Date               // Record update timestamp
}
```

### Session Types

- **regular**: Standard scheduled class session
- **extra**: Additional session outside regular schedule
- **practical**: Lab or hands-on session

---

## Error Responses

### 401 Unauthorized
```json
{
  "status": 401,
  "message": "Unauthorized - Invalid or expired session"
}
```

### 403 Forbidden
```json
{
  "status": 403,
  "error": "Forbidden",
  "message": "This route requires one of the following roles: teacher, hod, principal, staff, admin"
}
```

or

```json
{
  "status_code": 403,
  "message": "You are not authorized to update this session",
  "data": ""
}
```

### 404 Not Found
```json
{
  "status_code": 404,
  "message": "Attendance session not found",
  "data": ""
}
```

or

```json
{
  "status_code": 404,
  "message": "Authenticated user profile not found",
  "data": ""
}
```

### 500 Server Error
```json
{
  "status_code": 500,
  "message": "Failed to create attendance session",
  "error": "Error details..."
}
```

---

## Notes

### Automatic Field Population

The API automatically populates related data:
- **batch**: Includes `name`, `id`, `adm_year`, and `department`
- **subject**: Includes `name`, `subject_code`, `sem`, and `type`
- **created_by**: Includes user details directly (`name`, `email`, `first_name`, `last_name`, `role`)

### Authorization

- All routes require authentication
- Only staff members can access these endpoints
- Update and delete operations have additional authorization checks:
  - The creator of the session can modify/delete it
  - Admin, Principal, and HOD can modify/delete any session

### Filtering

The list endpoint supports multiple filters that can be combined:
- Filter by batch to see all sessions for a specific class
- Filter by subject to track sessions for a particular course
- Filter by session type to distinguish regular classes from extra or practical sessions
- Use date range filters to get sessions within a specific time period

### Timestamps

- All sessions include `createdAt` and `updatedAt` timestamps
- These are automatically managed by the system
- The `updatedAt` field is refreshed on every update operation

### Best Practices

1. **Ensure staff role access**: Only staff roles can create sessions, and ownership is mapped from the authenticated user
2. **Use proper date formats**: Session dates should be in ISO 8601 format
3. **Set accurate hours**: The `hours_taken` field should accurately reflect the session duration
4. **Choose appropriate session type**: Use the correct type (`regular`, `extra`, `practical`) for proper session categorization

### Related Models

- **Batch**: Referenced in the `batch` field
- **Subject**: Referenced in the `subject` field  
- **User**: Referenced in the `created_by` field
- **AttendanceRecord**: Links to this session for individual student attendance tracking
