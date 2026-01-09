import { createContextKey } from '@opentelemetry/api';

// This is the unique symbol used to store the Bug Session ID inside the OTel Context
export const BUG_SESSION_KEY = createContextKey('BugSessionID');