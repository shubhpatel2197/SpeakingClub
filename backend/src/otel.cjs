const { NodeSDK } = require('@opentelemetry/sdk-node')
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node')
const { resourceFromAttributes } = require('@opentelemetry/resources')
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions')
const { PrismaInstrumentation } = require('@prisma/instrumentation')

const FileSpanExporter = require('./traceFileExporter.cjs')

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'project-1-backend',
  }),
  traceExporter: new FileSpanExporter('logs/traces.jsonl'),
  instrumentations: [
    getNodeAutoInstrumentations(),
    new PrismaInstrumentation(),
  ],
})

sdk.start()

console.log('otel initialized')
