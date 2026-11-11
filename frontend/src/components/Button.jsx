// Button.jsx — the one button style for the whole site.
// variant: "primary" (main action), "secondary" (outlined), "ghost" (text only), "danger".
// `icon` takes a lucide icon component; `loading` disables it and shows a spinner.
// The mobile app has a Button with the same props. Owner: Huzaifah.
import { Loader2 } from 'lucide-react';

export default function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} btn--${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 size={18} className="spin" aria-hidden />
      ) : (
        Icon && <Icon size={18} aria-hidden />
      )}
      {children}
    </button>
  );
}
