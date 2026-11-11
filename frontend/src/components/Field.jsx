// Field.jsx — a form label with its input, an optional hint, and the error under the field.
// Usage: <Field label="RAM" unit="GB" htmlFor="ram" error={errors.ram}><input id="ram" … /></Field>
// Owner: Huzaifah.
export default function Field({ label, unit, hint, error, htmlFor, children }) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`}>
      <label className="field__label" htmlFor={htmlFor}>
        {label}
        {unit && <span className="field__unit"> ({unit})</span>}
      </label>
      {children}
      {error ? (
        <p className="field__error">{error}</p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}
