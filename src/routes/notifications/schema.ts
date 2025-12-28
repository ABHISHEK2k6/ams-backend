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
                maxLength: 3
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
                maxLength: 3
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
