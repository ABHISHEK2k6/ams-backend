# User API Documentation

Base URL: `/user`

## Table of Contents
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Get User Profile](#get-user-profile)
  - [Create User](#create-user)
  - [Update User](#update-user)
  - [Admin: Update User by ID](#admin-update-user-by-id)
  - [Admin: Delete User](#admin-delete-user)

---

## Authentication

Most endpoints require authentication via better-auth session cookies. Admin endpoints require the `admin` role.

**Middleware Used:**
- `authMiddleware` - Verifies user session
- `isAdmin` - Validates admin role (admin routes only)

---

## Endpoints

### Get User Profile

Retrieve the authenticated user's profile or a specific user's profile by ID.

**Endpoint:** `GET /user` or `GET /user/:id`

**Authentication:** Required

**Parameters:**
- `id` (optional, path parameter) - User ID to fetch. If omitted, returns the authenticated user's profile.

**Response Codes:**
- `200` - Success
- `404` - User not found
- `422` - User data not added (role-specific data missing)
- `401` - Unauthorized

**Response Examples:**

Student Profile:
```json
{
  "status_code": 200,
  "message": "User profile fetched successfully",
  "data": {
    "_id": "student_id",
    "user": {
      "name": "John Doe",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "student",
      "phone": 1234567890,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    "gender": "male",
    "adm_number": "ADM2024001",
    "adm_year": 2024,
    "candidate_code": "CAND001",
    "department": "CSE",
    "date_of_birth": "2005-01-15T00:00:00.000Z"
  }
}
```

Teacher Profile:
```json
{
  "status_code": 200,
  "message": "User profile fetched successfully",
  "data": {
    "_id": "teacher_id",
    "user": {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "role": "teacher",
      "phone": 9876543210
    },
    "designation": "Assistant Professor",
    "department": "CSE",
    "date_of_joining": "2020-06-01T00:00:00.000Z"
  }
}
```

Parent Profile:
```json
{
  "status_code": 200,
  "message": "User profile fetched successfully",
  "data": {
    "_id": "parent_id",
    "user": {
      "name": "Robert Brown",
      "email": "robert@example.com",
      "role": "parent"
    },
    "child": {
      "adm_number": "ADM2024001",
      "adm_year": 2024,
      "user": {
        "name": "Child Name",
        "email": "child@example.com"
      }
    },
    "relation": "father"
  }
}
```

---

### Create User

Create a new user account with role-specific data.

**Endpoint:** `POST /user`

**Authentication:**  Required

**Request Body:**

**Common Fields (Required):**
```json
{
  "name": "string (min 3 chars)",
  "email": "string",
  "first_name": "string",
  "last_name": "string",
  "gender": "male | female | other",
  "phone": "number"
}
```

**Optional Fields:**
- `image` - Profile image URL
- `role` - User role (defaults to "student")

**Role-Specific Required Objects:**

**For Students (`role: "student"`):**
```json
{
  "student": {
    "adm_number": "string",
    "adm_year": "number",
    "candidate_code": "string (optional)",
    "department": "CSE | ECE | IT",
    "date_of_birth": "YYYY-MM-DD"
  }
}
```

**For Teachers/Staff (`role: "teacher" | "principal" | "hod" | "staff" | "admin"`):**
```json
{
  "teacher": {
    "designation": "string",
    "department": "string",
    "date_of_joining": "YYYY-MM-DD"
  }
}
```

**For Parents (`role: "parent"`):**
```json
{
  "parent": {
    "relation": "mother | father | guardian",
    "childID": "string (student ID)"
  }
}
```

**Response:**
```json
{
  "status_code": 201,
  "message": "Student User created successfully",
  "data": ""
}
```

**Response Codes:**
- `201` - User created successfully
- `500` - Server error

---

### Update User

Update the authenticated user's profile.

**Endpoint:** `PUT /user`

**Authentication:** Required

**Request Body:**

All fields are optional. Only include fields you want to update.

```json
{
  "name": "string",
  "password": "string",
  "image": "string",
  "role": "string",
  "phone": "number",
  "first_name": "string",
  "last_name": "string",
  "gender": "male | female | other",
  "student": {
    "adm_number": "string",
    "adm_year": "number",
    "candidate_code": "string",
    "department": "CSE | ECE | IT",
    "date_of_birth": "YYYY-MM-DD"
  },
  "teacher": {
    "designation": "string",
    "department": "string",
    "date_of_joining": "YYYY-MM-DD"
  },
  "parent": {
    "relation": "mother | father | guardian",
    "childID": "string"
  }
}
```

**Example:**
```bash
curl -X PUT http://localhost:4000/user \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "name": "John Updated",
    "student": {
      "department": "ECE"
    }
  }'
```

**Response:**
```json
{
  "status_code": 200,
  "message": "User Record Updated Successfully",
  "data": ""
}
```

**Response Codes:**
- `200` - Updated successfully
- `404` - Record not found or nothing to update
- `401` - Unauthorized

---

### Admin: Update User by ID

Update any user's profile (admin only).

**Endpoint:** `PUT /user/:id`

**Authentication:** Required (Admin role)

**Parameters:**
- `id` (path parameter) - User ID to update

**Request Body:** Same as [Update User](#update-user)

**Example:**
```bash
curl -X PUT http://localhost:4000/user/user123 \
  -H "Content-Type: application/json" \
  -H "Cookie: admin-session-cookie" \
  -d '{
    "role": "teacher",
    "teacher": {
      "designation": "Professor"
    }
  }'
```

**Response:**
```json
{
  "status_code": 200,
  "message": "User Record Updated Successfully",
  "data": ""
}
```

**Response Codes:**
- `200` - Updated successfully
- `403` - Forbidden (not admin)
- `404` - User not found
- `401` - Unauthorized

---

### Admin: Delete User

Delete a user and all associated data (admin only).

**Endpoint:** `DELETE /user/:id`

**Authentication:** Required (Admin role)

**Parameters:**
- `id` (path parameter) - User ID to delete

**Behavior:**
- Removes user from better-auth
- Deletes user record from database
- Cascades deletion to role-specific data:
  - Student: Deletes student record and associated parent records
  - Teacher/Staff: Deletes teacher record
  - Parent: Deletes parent record

**Response:**
```json
{
  "status_code": 204,
  "message": "Successfully Deleted The User",
  "data": ""
}
```

**Response Codes:**
- `204` - Deleted successfully
- `403` - Forbidden (not admin)
- `404` - User not found or can't delete
- `401` - Unauthorized

---

## Data Models

### User Roles
- `student` - Student users
- `teacher` - Teaching staff
- `parent` - Parent/Guardian
- `principal` - School principal
- `hod` - Head of Department
- `staff` - Administrative staff
- `admin` - System administrator

### Departments
- `CSE` - Computer Science & Engineering
- `ECE` - Electronics & Communication Engineering
- `IT` - Information Technology

### Gender Options
- `male`
- `female`
- `other`

### Parent Relations
- `mother`
- `father`
- `guardian`

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
  "error": "This route requires one of the following roles: admin"
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

**422 Unprocessable Entity:**
```json
{
  "status_code": 422,
  "message": "Student data need to be added.",
  "data": ""
}
```

**500 Server Error:**
```json
{
  "status_code": 500,
  "message": "Error message",
  "error": "Error details"
}
```

---

## Notes

1. **Session Management**: Authentication is handled via better-auth session cookies. Include cookies in requests after login.

2. **Role-Based Data**: When creating or updating users, ensure the appropriate role-specific object (`student`, `teacher`, or `parent`) is included based on the user's role.

3. **Cascading Deletes**: Deleting a student will also remove any parent records associated with that student.

4. **Profile Completion**: After signup, users must have their role-specific data populated. The GET endpoint returns a 422 status if this data is missing.

5. **Admin Privileges**: Admin routes (`PUT /user/:id` and `DELETE /user/:id`) require admin role authentication.

6. **Default Role**: New users are automatically assigned the "student" role unless specified otherwise.
