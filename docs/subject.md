# Subject API Documentation

## Overview
The Subject API allows management of course subjects in the AMS system. Subjects contain information about courses including semester, subject code, type (Theory/Practical), marks distribution, and assigned faculty members.

All endpoints require authentication. List and retrieve operations are accessible to any staff member, while create, update, and delete operations require admin privileges.

## Base URL
```
/subject
```

## Authentication
All endpoints require a valid authentication token. Include the token in your request headers or cookies as configured in the Better-Auth system.

## Endpoints

### 1. List Subjects
Retrieve a paginated list of all subjects with optional filtering.

**Endpoint:** `GET /academics/subject`

**Access:** Any staff (teacher, hod, principal, staff, admin)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number for pagination |
| limit | number | No | 10 | Number of items per page (max: 100) |
| sem | string | No | - | Filter by semester |
| type | string | No | - | Filter by type (Theory, Practical) |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Subjects retrieved successfully",
  "data": {
    "subjects": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "Data Structures and Algorithms",
        "sem": "1",
        "subject_code": "CS101",
        "type": "Theory",
        "total_marks": 100,
        "pass_mark": 40,
        "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith"]
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

### 2. Get Subject by ID
Retrieve details of a specific subject.

**Endpoint:** `GET /academics/subject/:id`

**Access:** Any staff (teacher, hod, principal, staff, admin)

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Subject ID |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Subject retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures and Algorithms",
    "sem": "1",
    "subject_code": "CS101",
    "type": "Theory",
    "total_marks": 100,
    "pass_mark": 40,
    "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith"]
  }
}
```

**Error Responses:**
- `404`: Subject not found

---

### 3. Create Subject
Create a new subject.

**Endpoint:** `POST /academics/subject`

**Access:** Admin only

**Request Body:**
```json
{
  "name": "Data Structures and Algorithms",
  "sem": "1",
  "subject_code": "CS101",
  "type": "Theory",
  "total_marks": 100,
  "pass_mark": 40,
  "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith"]
}
```

**Body Parameters:**
| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| name | string | Yes | Min length: 1 | Subject name |
| sem | string | Yes | Min length: 1 | Semester (e.g., "1", "2", "3") |
| subject_code | string | Yes | Min length: 1 | Subject code (e.g., "CS101") |
| type | string | Yes | Enum: Theory, Practical | Subject type |
| total_marks | number | Yes | Minimum: 0 | Maximum marks for the subject |
| pass_mark | number | Yes | Minimum: 0 | Passing marks threshold |
| faculty_in_charge | string[] | No | - | Array of faculty names (optional) |

**Response Example:**
```json
{
  "status_code": 201,
  "message": "Subject created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures and Algorithms",
    "sem": "1",
    "subject_code": "CS101",
    "type": "Theory",
    "total_marks": 100,
    "pass_mark": 40,
    "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith"]
  }
}
```

**Error Responses:**
- `422`: Pass mark cannot be greater than total marks

---

### 4. Update Subject
Update an existing subject.

**Endpoint:** `PUT /academics/subject/:id`

**Access:** Admin only

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Subject ID |

**Request Body:**
```json
{
  "sem": "2",
  "total_marks": 150,
  "pass_mark": 60,
  "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith", "Dr. Alice Brown"]
}
```

**Body Parameters:**
All parameters are optional. Only provide fields you want to update.

| Parameter | Type | Constraints | Description |
|-----------|------|-------------|-------------|
| name | string | Min length: 1 | Subject name |
| sem | string | Min length: 1 | Semester |
| subject_code | string | Min length: 1 | Subject code |
| type | string | Enum: Theory, Practical | Subject type |
| total_marks | number | Minimum: 0 | Maximum marks |
| pass_mark | number | Minimum: 0 | Passing marks |
| faculty_in_charge | string[] | - | Array of faculty names |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Subject updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures and Algorithms",
    "sem": "2",
    "subject_code": "CS101",
    "type": "Theory",
    "total_marks": 150,
    "pass_mark": 60,
    "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith", "Dr. Alice Brown"]
  }
}
```

**Error Responses:**
- `404`: Subject not found
- `422`: Pass mark cannot be greater than total marks

---

### 5. Delete Subject
Delete a subject.

**Endpoint:** `DELETE /academics/subject/:id`

**Access:** Admin only

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Subject ID |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Subject deleted successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Data Structures and Algorithms",
    "sem": "1",
    "subject_code": "CS101",
    "type": "Theory",
    "total_marks": 100,
    "pass_mark": 40,
    "faculty_in_charge": ["Dr. John Doe", "Prof. Jane Smith"]
  }
}
```

**Error Responses:**
- `404`: Subject not found

---

## Data Models

### Subject
```typescript
{
  _id: string, // Auto-generated MongoDB ObjectId
  name: string,
  sem: string,
  subject_code: string,
  type: "Theory" | "Practical",
  total_marks: number,
  pass_mark: number,
  faculty_in_charge: string[], // Array of teacher names (optional)
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 422 | Unprocessable Entity - Validation error or duplicate data |
| 500 | Server Error - Internal server error |

---

## Notes

1. **Auto-generated ID**: The _id field is automatically generated by MongoDB as an ObjectId, eliminating the need to provide custom IDs.

2. **Subject Name**: Each subject now requires a descriptive name (e.g., "Data Structures and Algorithms") in addition to the subject_code.

3. **Faculty In Charge**: This field is optional. If not provided, an empty array will be stored. Currently stores faculty names as strings in an array. This is a simplified approach and might be changed to ObjectId references in future versions.

4. **Marks Validation**: The system ensures that pass_mark cannot exceed total_marks during both creation and updates.

5. **Subject Types**: Only two types are supported: Theory and Practical.

6. **Soft Relations**: Deleting a subject does not automatically cascade to attendance sessions or grade records. Ensure proper cleanup logic in your application if needed.

7. **Pagination**: Default pagination is 10 items per page with a maximum of 100 items per page.

8. **Sorting**: Subjects are sorted by semester and subject_code (both ascending) by default.

9. **Semester Format**: The semester field is stored as a string to support flexible formats like "1", "S1", "Fall 2024", etc.

---

## Best Practices

1. **Subject Naming**: Provide clear, descriptive subject names that help users identify courses quickly.

2. **Subject Code Convention**: Use consistent subject codes (e.g., CS101, CS102) for easier identification and sorting.

3. **Faculty Management**: When updating faculty_in_charge, provide the complete array as it replaces the existing array entirely. Leave it empty or omit it if no faculty is assigned yet.

4. **Marks Configuration**: Ensure total_marks and pass_mark values align with your institution's grading policy.

5. **Type Selection**: Choose "Theory" for classroom-based courses and "Practical" for lab-based courses.

6. **Batch Cleanup**: Before deleting a subject, ensure no active attendance sessions or grade records reference it.

---

**Last Updated:** January 22, 2026
