'use strict'

import authMiddleware from "@/middleware/auth"
import { FastifyInstance } from "fastify"
import os from "os"

export default async function (fastify: FastifyInstance) {

  fastify.setNotFoundHandler(function (req, reply) {
    reply.code(404).send({ message: 'You are looking at the wrong path! ￣へ￣', status: 404 })
  }) 

  fastify.get("/", async () => {
    return { message: "Hi User <3 - AMS Backend Server", 
      version: process.env.VERSION || "dev", 
      timestamp: new Date().toISOString(),
    };
});

  fastify.get("/health", async () => {
    return { message: "OK.", 
      version: process.env.VERSION || "dev", 
      timestamp: new Date().toISOString(),
      uptime: {
        process: process.uptime().toFixed(0),
        server: os.uptime().toFixed(0)
      }
    };
}).addHook("preHandler" , authMiddleware)
  
}
