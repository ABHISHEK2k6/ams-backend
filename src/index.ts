import "dotenv/config";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

import Fastify from "fastify";
import cors from "@fastify/cors";
import AutoLoad from "@fastify/autoload";

import { auth } from "./plugins/auth/index.js";

const fastify = Fastify({
	logger: true,
});

// CORS configuration
fastify.register(cors, {
	origin: [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN_DEV].filter((origin): origin is string => !!origin),
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	credentials: true,
	maxAge: 86400,
});

// Register routes
const __filename = fileURLToPath(import.meta.url) 
fastify.register(AutoLoad, {
  dir: path.join(dirname(__filename), 'routes'),
  options: { prefix: 'v1/api/' }
});


// Auth routes - better-auth
fastify.route({
	method: ["GET", "POST"],
	url: "/api/auth/*",
	async handler(request, reply) {
		try {
			const url = new URL(request.url, `http://${request.headers.host}`);
			const headers = new Headers();
			Object.entries(request.headers).forEach(([key, value]) => {
				if (value) headers.append(key, value.toString());
			});
			const req = new Request(url.toString(), {
				method: request.method,
				headers,
				body: request.body ? JSON.stringify(request.body) : undefined,
			});
			const response = await auth.handler(req);
			reply.status(response.status);
			response.headers.forEach((value, key) => reply.header(key, value));
			reply.send(response.body ? await response.text() : null);
		} catch (error) {
			fastify.log.error({ err: error }, "Authentication Error:");
			reply.status(500).send({
				error: "Internal authentication error",
				code: "AUTH_FAILURE",
			});
		}
	},
});


fastify.listen({ port: Number(process.env.PORT) || 3000 }, (err) => {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	console.log(`Server running on port ${process.env.PORT || 3000}`);
});
