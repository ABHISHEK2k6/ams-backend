# Attendance Record API Documentation

Base URL: `/attendance/record`

## Table of Contents
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [List Attendance Records](#list-attendance-records)
  - [Get Attendance Record](#get-attendance-record)
  - [Create Single Attendance Record](#create-single-attendance-record)
  - [Create Bulk Attendance Records](#create-bulk-attendance-records)
  - [Update Attendance Record](#update-attendance-record)
  - [Delete Attendance Record](#delete-attendance-record)
- [Data Model](#data-model)
- [Error Responses](#error-responses)
- [Notes](#notes)

---

## Authentication

All endpoints require authentication via session cookies.

- Read endpoints (`GET /attendance/record`, `GET /attendance/record/:id`) are accessible to staff members and students.
- Write endpoints (`POST`, `PUT`, `DELETE`) are restricted to staff members only.
- Students can only view their own attendance records.

**Middleware Used:**
- `authMiddleware` – Verifies user session ([src/middleware/auth.ts](../../src/middleware/auth.ts))
- `isAnyStaffOrStudent` – Allows read routes for staff and student ([src/middleware/roles.ts](../../src/middleware/roles.ts))
- `isAnyStaff` – Restricts write routes to staff members ([src/middleware/roles.ts](../../src/middleware/roles.ts))

---

## Endpoints

### List Attendance Records

Retrieve a paginated list of attendance records with optional filtering.

**Endpoint:** `GET /attendance/record`

**Authentication:** Required (Staff and Student)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (minimum: 1) |
| `limit` | number | No | 10 | Items per page (minimum: 1, maximum: 100) |
| `session` | string | No | - | Filter by attendance session ID |
| `student` | string | No | - | Filter by student ID |
| `status` | string | No | - | Filter by status: `present`, `absent`, `late`, or `excused` |
| `from_date` | string | No | - | Filter records from this date (format: YYYY-MM-DD) |
| `to_date` | string | No | - | Filter records until this date (format: YYYY-MM-DD) |

**Response Codes:**
- `200` – Success
- `401` – Unauthorized
- `403` – Forbidden (not authorized to view requested data)
- `500` – Server error

**Student Access Rule:**
- When called by a student, results are automatically limited to that student's own records, even if a different `student` query parameter is provided.

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance records fetched successfully",
  "data": {
    "records": [
      {
        "_id": "record_id_1",
        "student": {
          "_id": "student_id",
          "user": {
            "name": "John Doe",
            "email": "john@uck.ac.in",
            "first_name": "John",
            "last_name": "Doe"
          }
        },
        "session": {
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
          }
        },
        "marked_by": {
          "_id": "teacher_id",
          "user": {
            "name": "Dr. Jane Smith",
            "email": "jane.smith@uck.ac.in",
            "first_name": "Jane",
            "last_name": "Smith"
          }
        },
        "status": "present",
        "remarks": "",
        "marked_at": "2026-01-21T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    }
  }
}
```

---

### Get Attendance Record

Retrieve details of a specific attendance record.

**Endpoint:** `GET /attendance/record/:id`

**Authentication:** Required (Staff and Student)

**Path Parameters:**
- `id` (required) - Attendance record ID

**Response Codes:**
- `200` – Success
- `404` – Record not found
- `401` – Unauthorized
- `403` – Forbidden
- `500` – Server error

**Student Access Rule:**
- Students can fetch only records where `student` matches their authenticated user ID.

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance record fetched successfully",
  "data": {
    "_id": "record_id",
    "student": {
      "_id": "student_id",
      "user": {
        "name": "John Doe",
        "email": "john@uck.ac.in",
        "first_name": "John",
        "last_name": "Doe"
      }
    },
    "session": {
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
      }
    },
    "marked_by": {
      "_id": "teacher_id",
      "user": {
        "name": "Dr. Jane Smith",
        "email": "jane.smith@uck.ac.in",
        "first_name": "Jane",
        "last_name": "Smith"
      }
    },
    "status": "present",
    "remarks": "",
    "marked_at": "2026-01-21T09:00:00.000Z"
  }
}
```

---

### Create Single Attendance Record

Create a new attendance record for a student in a session. The `marked_by` field is automatically set to the authenticated teacher.

**Endpoint:** `POST /attendance/record`

**Authentication:** Required (Staff only)

**Request Body:**
```json
{
  "session": "session_id",
  "student": "student_id",
  "status": "present",
  "remarks": "Optional remarks"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session` | string | Yes | Attendance session ID (references AttendanceSession) |
| `student` | string | Yes | Student ID (references Student model) |
| `status` | string | Yes | Status: `present`, `absent`, `late`, or `excused` |
| `remarks` | string | No | Optional remarks or notes |

**Response Codes:**
- `201` – Created
- `400` – Invalid request body
- `404` – Teacher profile or session not found
- `422` – Record already exists for this student in this session
- `401` – Unauthorized
- `403` – Forbidden
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 201,
  "message": "Attendance record created successfully",
  "data": {
    "_id": "new_record_id",
    "session": "session_id",
    "student": "student_id",
    "marked_by": "teacher_id",
    "status": "present",
    "remarks": "",
    "marked_at": "2026-01-21T09:00:00.000Z"
  }
}
```

---

### Create Bulk Attendance Records

Create multiple attendance records for a session at once. This is useful for marking attendance for an entire class.

**Endpoint:** `POST /attendance/record/bulk`

**Authentication:** Required (Staff only)

**Request Body:**
```json
{
  "session": "session_id",
  "records": [
    {
      "student": "student_id_1",
      "status": "present",
      "remarks": ""
    },
    {
      "student": "student_id_2",
      "status": "absent",
      "remarks": "Informed absence"
    },
    {
      "student": "student_id_3",
      "status": "late",
      "remarks": "Arrived 15 minutes late"
    }
  ]
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `session` | string | Yes | Attendance session ID (references AttendanceSession) |
| `records` | array | Yes | Array of attendance records (minimum 1 item) |
| `records[].student` | string | Yes | Student ID |
| `records[].status` | string | Yes | Status: `present`, `absent`, `late`, or `excused` |
| `records[].remarks` | string | No | Optional remarks |

**Response Codes:**
- `201` – Created (returns created records and any errors)
- `400` – Invalid request body
- `404` – Teacher profile or session not found
- `401` – Unauthorized
- `403` – Forbidden
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 201,
  "message": "Successfully created 3 attendance records",
  "data": {
    "created": [
      {
        "_id": "record_id_1",
        "session": "session_id",
        "student": "student_id_1",
        "marked_by": "teacher_id",
        "status": "present",
        "remarks": "",
        "marked_at": "2026-01-21T09:00:00.000Z"
      },
      {
        "_id": "record_id_2",
        "session": "session_id",
        "student": "student_id_2",
        "marked_by": "teacher_id",
        "status": "absent",
        "remarks": "Informed absence",
        "marked_at": "2026-01-21T09:00:00.000Z"
      },
      {
        "_id": "record_id_3",
        "session": "session_id",
        "student": "student_id_3",
        "marked_by": "teacher_id",
        "status": "late",
        "remarks": "Arrived 15 minutes late",
        "marked_at": "2026-01-21T09:00:00.000Z"
      }
    ],
    "errors": [
      {
        "student": "student_id_4",
        "message": "Record already exists"
      }
    ]
  }
}
```

**Note:** The bulk endpoint will skip students that already have records for the session and report them in the `errors` array.

---

### Update Attendance Record

Update an existing attendance record. Only the record marker or admin/principal/hod can update.

**Endpoint:** `PUT /attendance/record/:id`

**Authentication:** Required (Staff only)

**Path Parameters:**
- `id` (required) - Attendance record ID

**Authorization:**
- Record marker (teacher who marked the attendance) can update their own records
- Admin, Principal, or HOD can update any record

**Request Body:**
All fields are optional. Only include fields you want to update.

```json
{
  "status": "excused",
  "remarks": "Medical leave approved"
}
```

**Request Body Schema:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Status: `present`, `absent`, `late`, or `excused` |
| `remarks` | string | No | Remarks or notes |

**Response Codes:**
- `200` – Updated successfully
- `400` – Invalid request body
- `404` – Record not found
- `403` – Forbidden (not authorized to update this record)
- `401` – Unauthorized
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance record updated successfully",
  "data": {
    "_id": "record_id",
    "student": {
      "_id": "student_id",
      "user": {
        "name": "John Doe",
        "email": "john@uck.ac.in",
        "first_name": "John",
        "last_name": "Doe"
      }
    },
    "session": {
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
      }
    },
    "marked_by": {
      "_id": "teacher_id",
      "user": {
        "name": "Dr. Jane Smith",
        "email": "jane.smith@uck.ac.in"
      }
    },
    "status": "excused",
    "remarks": "Medical leave approved",
    "marked_at": "2026-01-21T09:00:00.000Z"
  }
}
```

---

### Delete Attendance Record

Delete an attendance record. Only the record marker or admin/principal/hod can delete.

**Endpoint:** `DELETE /attendance/record/:id`

**Authentication:** Required (Staff only)

**Path Parameters:**
- `id` (required) - Attendance record ID

**Authorization:**
- Record marker (teacher who marked the attendance) can delete their own records
- Admin, Principal, or HOD can delete any record

**Response Codes:**
- `200` – Deleted successfully
- `404` – Record not found
- `403` – Forbidden (not authorized to delete this record)
- `401` – Unauthorized
- `500` – Server error

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Attendance record deleted successfully",
  "data": ""
}
```

---

## Data Model

The `AttendanceRecord` model represents individual student attendance for a specific session.

### Schema

```typescript
{
  _id: string,
  student: ObjectId,            // References Student model
  session: ObjectId,            // References AttendanceSession model
  marked_by: ObjectId,          // References Teacher model (who marked attendance)
  status: string,               // "present" | "absent" | "late" | "excused"
  remarks: string,              // Optional remarks or notes
  marked_at: Date               // When attendance was marked
}
```

### Attendance Status Types

- **present**: Student was present for the entire session
- **absent**: Student was not present
- **late**: Student arrived late but attended the session
- **excused**: Student was absent but with valid reason (medical, etc.)

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
  "message": "You are not authorized to update this record",
  "data": ""
}
```

### 404 Not Found
```json
{
  "status_code": 404,
  "message": "Attendance record not found",
  "data": ""
}
```

or

```json
{
  "status_code": 404,
  "message": "Teacher profile not found",
  "data": ""
}
```

or

```json
{
  "status_code": 404,
  "message": "Attendance session not found",
  "data": ""
}
```

### 422 Unprocessable Entity
```json
{
  "status_code": 422,
  "message": "Attendance record already exists for this student in this session",
  "data": ""
}
```

### 500 Server Error
```json
{
  "status_code": 500,
  "message": "Failed to create attendance record",
  "error": "Error details..."
}
```

---

## Notes

### Automatic Field Population

The API automatically populates related data:
- **student**: Includes student profile with nested user information (name, email, etc.)
- **session**: Includes session details with nested batch and subject information
- **marked_by**: Includes teacher details with nested user information

### Authorization

- All routes require authentication
- Read routes are available to staff and students
- Write routes are restricted to staff members
- Students can only view their own attendance records
- Update and delete operations have additional authorization checks:
  - The marker of the record can modify/delete it
  - Admin, Principal, and HOD can modify/delete any record

### Duplicate Prevention

- The single create endpoint checks if a record already exists for the student in the specified session
- Returns a 422 error if a duplicate is detected
- The bulk create endpoint skips duplicates and reports them in the `errors` array

### Bulk Operations

The bulk create endpoint is designed for efficiency:
- Create multiple records in one request
- All records share the same session
- Each record can have different status and remarks
- Skips existing records instead of failing the entire operation
- Returns both successful creations and errors

### Filtering

The list endpoint supports multiple filters that can be combined:
- Filter by session to see all records for a specific class session
- Filter by student to track attendance for a specific student
- Filter by status to find all absences, late arrivals, etc.
- Use date range filters to get records within a specific time period

### Timestamps

- The `marked_at` field is automatically set when a record is created
- This field does not update when the record is modified
- It represents when the attendance was originally marked

### Best Practices

1. **Use bulk operations**: When marking attendance for a full class, use the `/bulk` endpoint instead of individual requests
2. **Validate session exists**: The API verifies the session exists before creating records
3. **Handle duplicates gracefully**: The bulk endpoint reports duplicates without failing
4. **Add meaningful remarks**: Use the remarks field to provide context for absences, late arrivals, etc.
5. **Check authorization**: Only modify records you created or have admin privileges for

### Workflow Example

1. Teacher creates an attendance session for a class
2. Teacher uses the bulk create endpoint to mark attendance for all students
3. If a student arrives late, teacher updates their record to "late" with appropriate remarks
4. If a student provides medical documentation, teacher updates the status to "excused"

### Related Models

- **Student**: Referenced in the `student` field
- **AttendanceSession**: Referenced in the `session` field
- **Teacher**: Referenced in the `marked_by` field
- **Batch**: Indirectly related through session
- **Subject**: Indirectly related through session
