import { RouteShorthandOptions } from "fastify";

export const notificationCreateSchema: RouteShorthandOptions["schema"] = {
    body: {
        type: "object",
        properties: {
            targetGroup: {
                type: "string",
                enum: ["college", "year", "batch", "department"],
            },
            targetID: {
                type: "string",
            },
            targetUsers: {
                type: "array",
                items: { type: "string" }
            },
            title: {
                type: "string",
                minLength: 3
            },
            message: {
                type: "string",
                minLength: 3
            },
            priorityLevel: {
                type: "string",
                enum: ["High", "Medium", "Low"]
            },
            notificationType: {
                type: "string",
                enum: ["announcement", "info", "results"]
            },
        },
        required: [
            "targetGroup",
            "targetUsers",
            "title",
            "message",
            "priorityLevel",
            "notificationType"
        ],
        allOf: [
            {
                if: {
                    properties: { targetGroup: { const: "college" } }
                },
                then: {
                    required: [
                        "targetGroup",
                        "targetUsers",
                        "title",
                        "message",
                        "priorityLevel",
                        "notificationType"
                    ],
                    properties: {
                        targetID: { not: {} }
                    }
                },
                else: {
                    required: [
                        "targetGroup",
                        "targetID",
                        "targetUsers",
                        "title",
                        "message",
                        "priorityLevel",
                        "notificationType"
                    ]
                }
            }
        ]
    }
};


export const notificationListAllSchema: RouteShorthandOptions["schema"] = {
    querystring: {
        type: "object",
        properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
            search: { type: "string", minLength: 1 },
            targetGroup: { type: "string", enum: ["college", "year", "batch", "department"] },
            notificationType: { type: "string", enum: ["announcement", "info", "results"] },
            priorityLevel: { type: "string", enum: ["High", "Medium", "Low"] },
            sort: { type: "string", enum: ["createdAt", "title", "priorityLevel"], default: "createdAt" },
            order: { type: "string", enum: ["asc", "desc"], default: "desc" },
        },
    },
};

export const notificationUpdateSchema: RouteShorthandOptions["schema"] = {
    body: {
        type: "object",
        required: [],
        properties: {
            targetGroup: {
                type: "string",
                enum: ["college", "year", "batch", "department"],
            },
            targetID: {
                type: "string",
            },
            targetUsers: {
                type: "array",
                items: { type: "string" }
            },
            title: {
                type: "string",
                minLength: 3
            },
            message: {
                type: "string",
                minLength: 3
            },
            priorityLevel: {
                type: "string",
                enum: ["High", "Medium", "Low"]
            },
            notificationType: {
                type: "string",
                enum: ["announcement", "info", "results"]
            },
        },

        allOf: [
            {
                if: {
                    properties: { targetGroup: { const: "college" } }
                },
                then: {
                    required: [],
                    properties: {
                        targetID: { not: {} }
                    }
                },
                else: {
                    required: []
                }
            }
        ],
        additionalProperties: false,
    },
};
