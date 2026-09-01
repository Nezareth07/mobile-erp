// Monetary formatting is centralized in src/lib/money.ts so the whole app
// shows Colombian pesos (COP) consistently. Re-exported here to keep this
// module's public API (formatCurrency) stable for existing callers.
export { formatCurrency } from '../../lib/money'
