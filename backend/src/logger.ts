// import pino from 'pino'
// import { trace, context } from '@opentelemetry/api'
// import fs from 'fs'
// import path from 'path'

// const logDir = path.join(process.cwd(), 'logs')

// if (!fs.existsSync(logDir)) {
//   fs.mkdirSync(logDir, { recursive: true })
// }

// const logFile = path.join(logDir, 'app.log')

// export const logger = pino(
//   {
//     level: 'info',
//     base: {
//       service: 'project-1-backend',
//     },
//     mixin() {
//       const span = trace.getSpan(context.active())

//       if (!span) return {}

//       const { traceId, spanId } = span.spanContext()

//       return {
//         trace_id: traceId,
//         span_id: spanId,
//       }
//     },
//     timestamp: pino.stdTimeFunctions.isoTime,
//   },
//   pino.destination({
//     dest: logFile,
//     sync: false, // async write (recommended)
//   })
// )
