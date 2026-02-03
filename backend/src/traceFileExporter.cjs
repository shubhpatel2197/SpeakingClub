const fs = require('fs')
const path = require('path')

class FileSpanExporter {
  constructor(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    this.stream = fs.createWriteStream(filePath, { flags: 'a' })
  }

  export(spans, resultCallback) {
    try {
      for (const span of spans) {
        const parent = span.parentSpanContext

        // Write as single-line JSON (JSONL format)
        this.stream.write(
          JSON.stringify({
            trace_id: span.spanContext().traceId,
            span_id: span.spanContext().spanId,
            parent_span_id: parent ? parent.spanId : null,

            name: span.name,
            kind: span.kind,

            start_time: span.startTime,
            end_time: span.endTime,

            duration_ms:
              (span.endTime[0] - span.startTime[0]) * 1000 +
              (span.endTime[1] - span.startTime[1]) / 1e6,

            attributes: span.attributes,
            resource: span.resource.attributes,

            instrumentation: {
              name: span.instrumentationScope.name,
              version: span.instrumentationScope.version,
            },

            status: span.status,
          }) + '\n'
        )
      }

      resultCallback({ code: 0 })
    } catch (err) {
      resultCallback({ code: 1, error: err })
    }
  }

  shutdown() {
    return new Promise((resolve) => {
      this.stream.end(resolve)
    })
  }
}

module.exports = FileSpanExporter