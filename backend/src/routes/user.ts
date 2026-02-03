// backend/src/routes/user.ts
import { Router } from 'express'
import fs from 'fs/promises'
import path from 'path'

const router = Router()

interface Trace {
  trace_id: string
  span_id: string
  parent_span_id?: string
  name: string
  kind: number
  start_time: number[]
  end_time: number[]
  duration_ms: number
  attributes: Record<string, any>
  resource: Record<string, any>
  instrumentation: {
    name: string
    version: string
  }
  status: {
    code: number
  }
}

interface LogEntry {
  level: number
  time: string
  service: string
  trace_id?: string
  span_id?: string
  trace_flags?: string
  msg?: string
  route?: string
  [key: string]: any
}

// GET /api/user/me
router.get('/me', (req, res) => {
  // req.user was attached by requireAuth
  console.log('req.user', req.user)
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' })
  return res.json({ user: req.user })
})

// GET /traces/:id - Get traces and logs for a specific trace ID
router.get('/:id', async (req, res) => {
  try {
    const traceId = req.params.id

    if (!traceId) {
      return res.status(400).json({ error: 'Trace ID is required' })
    }

    console.log('Fetching traces for traceId:', traceId)

    // Define file paths
    await new Promise(resolve => setTimeout(resolve, 3000))
    const tracesFilePath = path.join(process.cwd(), 'logs/traces.jsonl')
    const logsFilePath = path.join(process.cwd(), 'logs/app.log')

    let traces: Trace[] = []
    let logs: LogEntry[] = []

    // Read and parse traces.jsonl (JSONL format - one JSON per line)
    try {
      console.log('Reading traces from:', tracesFilePath)
      const tracesData = await fs.readFile(tracesFilePath, 'utf-8')
      console.log('File content length:', tracesData.length)
      
      // Split by newlines - each line is a complete JSON object
      const traceLines = tracesData.split('\n').filter(line => line.trim().length > 0)
      console.log('Total non-empty lines:', traceLines.length)
      
      const allTraces: Trace[] = []
      
      for (let i = 0; i < traceLines.length; i++) {
        const line = traceLines[i].trim()
        if (!line) continue
        
        try {
          const trace = JSON.parse(line)
          allTraces.push(trace)
        } catch (error) {
          console.error(`Failed to parse line ${i + 1}`)
          console.error('Line length:', line.length)
          console.error('First 200 chars:', line.substring(0, 200))
          console.error('Error:', error instanceof Error ? error.message : error)
        }
      }
      
      console.log('Successfully parsed traces:', allTraces.length)
      
      // Filter traces by trace_id
      traces = allTraces.filter((trace: Trace) => trace.trace_id === traceId)
      console.log('Matching traces found:', traces.length)
      
      if (allTraces.length > 0 && traces.length === 0) {
        console.log('Sample trace_ids from file:', allTraces.slice(0, 3).map(t => t.trace_id))
        console.log('Searching for:', traceId)
      }
    } catch (error) {
      console.error('Error reading traces.jsonl:', error)
      // Continue even if traces file doesn't exist
    }

    // Read and parse app.log (JSONL format)
    try {
      console.log('Reading logs from:', logsFilePath)
      const logsData = await fs.readFile(logsFilePath, 'utf-8')
      const logLines = logsData.trim().split('\n')
      
      // Parse each log line as JSON
      logs = logLines
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line)
          } catch (error) {
            console.error('Error parsing log line:', error)
            return null
          }
        })
        .filter((log): log is LogEntry => log !== null && log.trace_id === traceId)
      
      console.log('Matching logs found:', logs.length)
    } catch (error) {
      console.error('Error reading app.log:', error)
      // Continue even if log file doesn't exist
    }

    // Sort logs by time
    logs.sort((a, b) => 
      new Date(a.time).getTime() - new Date(b.time).getTime()
    )

    // Sort traces by start_time
    traces.sort((a, b) => {
      const aTime = a.start_time[0] + a.start_time[1] / 1e9
      const bTime = b.start_time[0] + b.start_time[1] / 1e9
      return aTime - bTime
    })

    // Return combined data
    return res.json({
      traceId,
      traceCount: traces.length,
      logCount: logs.length,
      traces,
      logs,
      summary: {
        startTime: logs[0]?.time || (traces[0] ? new Date(traces[0].start_time[0] * 1000).toISOString() : null),
        endTime: logs[logs.length - 1]?.time || (traces[traces.length - 1] ? new Date(traces[traces.length - 1].end_time[0] * 1000).toISOString() : null),
        totalEvents: traces.length + logs.length
      }
    })

  } catch (error) {
    console.error('Error fetching trace data:', error)
    return res.status(500).json({ 
      error: 'Failed to fetch trace data',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router