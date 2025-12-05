# 📚 User Management API Endpoints

This document describes the API endpoints for managing user profiles, including fetching, creation, updating, and deletion of user records across different roles (student, teacher, parent, staff).

---

## 1. Get User Profile

This endpoint fetches the profile details for the authenticated user based on their role.

* **URL:** `/`
* **Method:** `GET`
* **Authentication:** Requires authentication via `authMiddleware`.
* **Request Body:** None
* **Response (200 OK):**
    ```json
    {
      "status_code": 200,
      "message": "User profile fetched successfully",
      "data": {
        // User profile object (Student, Teacher, or Parent record)
        // populated with 'user' details.
      }
    }
    ```
* **Response (204 No Content - on error):**
    ```json
    {
      "status_code": 204,
      "error": "Error object",
      "data": ""
    }
    ```
* **Logic:**
    * Checks `request.user.role`.
    * **Student:** Fetches `Student` record and populates related `user` data.
    * **Teacher/Principal/HOD/Admin/Staff:** Fetches `Teacher` record and populates related `user` data.
    * **Parent:** Fetches `Parent` record, populates related `user` data, and populates the linked `child` (Student) record with its own `user` data.

---

## 2. Create New User Account

This endpoint is used to create a new user account and their corresponding role-specific record (Student, Teacher, or Parent).

* **URL:** `/`
* **Method:** `POST`
* **Authentication:** Requires authentication via `authMiddleware`..
* **Schema:** `userCreateSchema`
* **Request Body (JSON):**
    | Field | Type | Description | Required |
    | :--- | :--- | :--- | :--- |
    | `name` | `string` | User's full name. | Yes |
    | `email` | `string` | User's email address. | Yes |
    | `password` | `string` | User's desired password. | Yes |
    | `role` | `string` | The user's role: `student`, `teacher`, `principal`, `hod`, `admin`, `staff`, or `parent`. | Yes |
    | `phone` | `number` | User's phone number. | Yes |
    | `first_name` | `string` | User's first name. | Yes |
    | `last_name` | `string` | User's last name. | Yes |
    | `image` | `string` | Optional URL for user's profile image. | No |
    | `gender` | `string` | User's gender (required for `student` role). | Conditional |
    | `student` | `object` | Details for a **Student** user. | Conditional |
    | `student.adm_number` | `string` | Admission number. | yes |
    | `student.adm_year` | `number` | Admission year. | yes |
    | `student.candidate_code` | `string` | Candidate code. | yes |
    | `student.department` | `string` | Department/Course. | yes |
    | `student.date_of_birth` | `Date` | Date of birth. | yes |
    | `teacher` | `object` | Details for a **Teacher/Staff** user. | Conditional |
    | `teacher.designation` | `string` | Job designation. | yes |
    | `teacher.department` | `string` | Department. | yes |
    | `teacher.date_of_joining` | `Date` | Date of joining. | yes |
    | `parent` | `object` | Details for a **Parent** user. | Conditional |
    | `parent.relation` | `string` | Relation to the child (e.g., "father", "mother" , "guardian"). | YES |
    | `parent.childID` | `string` | **ID of the existing Student** record. | YES |
* **Response (201 Created - Success):**
    ```json
    {
      "status_code": 201,
      "message": "Student/Teacher/Parent User created successfully",
      "data": ""
    }
    ```
* **Response (500 Internal Server Error - Failure):**
    ```json
    // Error object from the catch block
    ```
* **Logic:**
    1.  Calls an external `auth.api.signUpEmail` to create the base user in the authentication system.
    2.  Sets the returned `Set-Cookie` header for the client.
    3.  Creates a new `User` document in the database using the ID from the authentication system.
    4.  Based on the `role`, it creates a corresponding `Student`, `Teacher`, or `Parent` record, linking it to the newly created `User` document.

---

## 3. Update User Account (Self)

This endpoint allows the authenticated user to update their own base profile and role-specific details.

* **URL:** `/`
* **Method:** `PUT`
* **Authentication:** Requires authentication.
* **Schema:** `userUpdateSchema`
* **Request Body (JSON):** Contains fields to be updated. The structure is similar to the `POST` request body but all fields are optional.
    * General fields: `name`, `password`, `image`, `phone`, `first_name`, `last_name`, `gender`.
    * Role-specific fields: `student`, `teacher`, or `parent` objects (containing fields relevant to the corresponding model).
* **Response (200 OK - Success):**
    ```json
    {
      "status_code": 200,
      "message": "User Record Updated Successfully",
      "data": ""
    }
    ```
* **Response (404 Not Found - Failure):**
    ```json
    {
      "status_code": 404,
      "message": "Nothing to Update" | "Student/Teacher Record Not Found" | "Some Error Occured",
      "data": "" | "Error object"
    }
    ```
* **Logic:**
    1.  If `name` or `image` are provided, updates the user in the external authentication system via `auth.api.updateUser`.
    2.  Updates the base `User` document in the database using `Request.user.id`.
    3.  If a role-specific update object (`updatedBody.student`, `updatedBody.teacher`, or `updatedBody.parent`) is present, it finds the corresponding record (`Student`, `Teacher`, or `Parent`) and updates it.

---

## 4. Update User Account (Admin Route)

This endpoint allows an **Administrator** to update any user's profile using their ID.

* **URL:** `/:id`
* **Method:** `PUT`
* **Authentication:** Requires authentication and `isAdmin` middleware.
* **URL Parameter:**
    | Parameter | Type | Description |
    | :--- | :--- | :--- |
    | `id` | `string` | The ID of the user to update. |
* **Schema:** `userUpdateSchema`
* **Request Body (JSON):** Same structure as the self-update endpoint, but can also optionally include the `role` field for role changes.
* **Response (200 OK - Success):**
    ```json
    {
      "status_code": 200,
      "message": "User Record Updated Successfully",
      "data": ""
    }
    ```
* **Response (404 Not Found - Failure):**
    ```json
    {
      "status_code": 404,
      "message": "Nothing to Update" | "Student/Teacher Record Not Found" | "Some Error Occured",
      "data": "" | "Error object"
    }
    ```
* **Logic:**
    * The logic is nearly identical to the self-update endpoint, but uses the user ID from the URL parameter (`userId`) for finding and updating records.

---

## 5. Delete User Account (Admin Route)

This endpoint allows an **Administrator** to delete a user account and all associated role-specific records.

* **URL:** `/:id`
* **Method:** `DELETE`
* **Authentication:** Requires authentication and `isAdmin` middleware.
* **URL Parameter:**
    | Parameter | Type | Description |
    | :--- | :--- | :--- |
    | `id` | `string` | The ID of the user to delete. |
* **Request Body:** None
* **Response (204 No Content - Success):**
    ```json
    {
      "status_code": 204,
      "message": "Successfully Deleted The User",
      "data": ""
    }
    ```
* **Response (404 Not Found - Failure):**
    ```json
    {
      "status_code": 404,
      "message": "Can't delete the user",
      "error": "Error object"
    }
    ```
* **Logic:**
    1.  Calls `authClient.admin.removeUser` to delete the base user from the authentication system.
    2.  Finds and deletes the base `User` document from the database.
    3.  Based on the deleted user's `role`:
        * **Student:** Deletes the `Student` record and any associated `Parent` records that link to this student.
        * **Parent:** Deletes the `Parent` record.
        * **Teacher/Staff:** Deletes the `Teacher` record.