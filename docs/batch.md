# Batch API Documentation

## Overview
The Batch API allows management of student batches/classes in the AMS system. Batches represent groups of students organized by admission year and department, with an assigned staff advisor.

All endpoints require authentication. List and retrieve operations are accessible to any staff member, while create, update, and delete operations require admin privileges.

## Base URL
```
/batch
```

## Authentication
All endpoints require a valid authentication token. Include the token in your request headers or cookies as configured in the Better-Auth system.

## Endpoints

### 1. List Batches
Retrieve a paginated list of all batches with optional filtering.

**Endpoint:** `GET /academics/batch`

**Access:** Any staff (teacher, hod, principal, staff, admin)

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number for pagination |
| limit | number | No | 10 | Number of items per page (max: 100) |
| department | string | No | - | Filter by department (CSE, ECE, IT) |
| adm_year | number | No | - | Filter by admission year |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Batches retrieved successfully",
  "data": {
    "batches": [
      {
        "_id": "64abc123def456",
        "id": "24CSE",
        "name": "CSE 2024 Batch A",
        "adm_year": 2024,
        "department": "CSE",
        "staff_advisor": {
          "_id": "64xyz789abc012",
          "user": {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com"
          }
        }
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

### 2. Get Batch by ID
Retrieve details of a specific batch.

**Endpoint:** `GET /academics/batch/:id`

**Access:** Any staff (teacher, hod, principal, staff, admin)

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Batch ObjectId |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Batch retrieved successfully",
  "data": {
    "_id": "64abc123def456",
    "id": "24CSE",
    "name": "CSE 2024 Batch A",
    "adm_year": 2024,
    "department": "CSE",
    "staff_advisor": {
      "_id": "64xyz789abc012",
      "user": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com"
      }
    }
  }
}
```

**Error Responses:**
- `404`: Batch not found

---

### 3. Create Batch
Create a new batch.

**Endpoint:** `POST /academics/batch`

**Access:** Admin only

**Request Body:**
```json
{
  "id": "24CSE",
  "name": "CSE 2024 Batch A",
  "adm_year": 2024,
  "department": "CSE",
  "staff_advisor": "64xyz789abc012"
}
```

**Body Parameters:**
| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| id | string | No | Pattern: `^[0-9]{2}[A-Z]{2,3}[0-9]*$` | Human-readable batch ID (defaults to `${lastTwoDigitsOfAdmYear}${DEPARTMENT}`) |
| batch_id | string | No | Pattern: `^[0-9]{2}[A-Z]{2,3}[0-9]*$` | Alias for `id` for client compatibility |
| name | string | Yes | Min length: 1 | Batch name |
| adm_year | number | Yes | 2000-2100 | Admission year |
| department | string | Yes | Enum: CSE, ECE, IT | Department code |
| staff_advisor | string | Yes | Valid Teacher ObjectId | Staff advisor ID |

**Response Example:**
```json
{
  "status_code": 201,
  "message": "Batch created successfully",
  "data": {
    "_id": "64abc123def456",
    "id": "24CSE",
    "name": "CSE 2024 Batch A",
    "adm_year": 2024,
    "department": "CSE",
    "staff_advisor": {
      "_id": "64xyz789abc012",
      "user": {
        "first_name": "John",
        "last_name": "Doe",
        "email": "john.doe@example.com"
      }
    }
  }
}
```

**Error Responses:**
- `404`: Staff advisor (teacher) not found
- `422`: Batch with this name and admission year already exists
- `422`: Batch with this ID already exists

**Notes:**
- If `id` or `batch_id` is omitted, it is generated as `${lastTwoDigitsOfAdmYear}${DEPARTMENT}` (example: `24CSE`).
- Numeric suffixes are supported (example: `24CSE1`, `24CSE2`).

---

### 4. Update Batch
Update an existing batch.

**Endpoint:** `PUT /academics/batch/:id`

**Access:** Admin only

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Batch ObjectId |

**Request Body:**
```json
{
  "name": "CSE 2024 Batch A (Updated)",
  "id": "24CSE",
  "department": "IT",
  "staff_advisor": "64xyz789abc999"
}
```

**Body Parameters:**
All parameters are optional. Only provide fields you want to update.

| Parameter | Type | Constraints | Description |
|-----------|------|-------------|-------------|
| id | string | Pattern: `^[0-9]{2}[A-Z]{2,3}[0-9]*$` | Human-readable batch ID |
| batch_id | string | Pattern: `^[0-9]{2}[A-Z]{2,3}[0-9]*$` | Alias for `id` |
| name | string | Min length: 1 | Batch name |
| adm_year | number | 2000-2100 | Admission year |
| department | string | Enum: CSE, ECE, IT | Department code |
| staff_advisor | string | Valid Teacher ObjectId | Staff advisor ID |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Batch updated successfully",
  "data": {
    "_id": "64abc123def456",
    "id": "24CSE",
    "name": "CSE 2024 Batch A (Updated)",
    "adm_year": 2024,
    "department": "IT",
    "staff_advisor": {
      "_id": "64xyz789abc999",
      "user": {
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane.smith@example.com"
      }
    }
  }
}
```

**Error Responses:**
- `404`: Batch not found
- `404`: Staff advisor (teacher) not found (if updating staff_advisor)
- `422`: Batch with this name and admission year already exists (if updating name/year)
- `422`: Batch with this ID already exists (if updating id)

---

### 5. Delete Batch
Delete a batch.

**Endpoint:** `DELETE /academics/batch/:id`

**Access:** Admin only

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Batch ObjectId |

**Response Example:**
```json
{
  "status_code": 200,
  "message": "Batch deleted successfully",
  "data": {
    "_id": "64abc123def456",
    "id": "24CSE",
    "name": "CSE 2024 Batch A",
    "adm_year": 2024,
    "department": "CSE",
    "staff_advisor": "64xyz789abc012"
  }
}
```

**Error Responses:**
- `404`: Batch not found

---

## Data Models

### Batch
```typescript
{
  _id: ObjectId,
  id: string,
  name: string,
  adm_year: number,
  department: "CSE" | "ECE" | "IT",
  staff_advisor: ObjectId, // Reference to Teacher
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

1. **Staff Advisor**: Must be a valid Teacher ObjectId. The system validates existence before creating/updating.

2. **Department Codes**: Only three departments are supported: CSE, ECE, IT.

3. **Unique Constraint**: A batch with the same name and admission year combination is considered duplicate and will be rejected.

4. **Soft Relations**: Deleting a batch does not automatically delete related students. Ensure proper cascading logic in your application if needed.

5. **Populated Data**: GET requests automatically populate the staff_advisor field with teacher and user details.

6. **Pagination**: Default pagination is 10 items per page with a maximum of 100 items per page.

7. **Sorting**: Batches are sorted by admission year (descending) and name (ascending) by default.

8. **ID Alias Support**: Both `id` and `batch_id` are accepted in create/update request bodies. If both are provided, `id` is used.

9. **Route Parameter Flexibility**: For `GET`, `PUT`, and `DELETE`, the `:id` route parameter now accepts either MongoDB ObjectId or the human-readable batch code.

---

**Last Updated:** April 16, 2026
