"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { customerAuthClient, signInWithGoogle } from "@/lib/customer-auth-client";

import styles from "./customer-auth.module.css";

type AuthMode = "sign-in" | "create-account";

function getErrorCode(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) return "";
  const error = result.error;
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

function getErrorMessage(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) return "";
  const error = result.error;
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "";
}

export function CustomerAccountAuth({ callbackURL }: { callbackURL: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setIdentifier("");
    setPassword("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || mode !== "sign-in") return;

    setIsPending(true);
    setError("");

    try {
      const value = identifier.trim();
      const result = value.includes("@")
        ? await customerAuthClient.signIn.email({ callbackURL, email: value, password })
        : await customerAuthClient.signIn.username({ callbackURL, password, username: value });

      if (getErrorCode(result)) {
        setError("Không thể đăng nhập. Hãy kiểm tra tên đăng nhập hoặc email và mật khẩu.");
        return;
      }

      router.replace(callbackURL);
      router.refresh();
    } catch {
      setError("Chưa thể xử lý yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setIsPending(false);
    }
  }

  async function googleSignIn() {
    setIsPending(true);
    setError("");
    try {
      const result = await signInWithGoogle(callbackURL);
      if (getErrorCode(result) || getErrorMessage(result)) {
        setError("Chưa thể đăng nhập bằng Google. Vui lòng thử lại sau.");
        setIsPending(false);
      }
    } catch {
      setError("Chưa thể đăng nhập bằng Google. Vui lòng thử lại sau.");
      setIsPending(false);
    }
  }

  return (
    <div className={styles.authMethods}>
      <div aria-label="Chọn thao tác tài khoản" className={styles.modeSwitcher} role="group">
        <button
          aria-pressed={mode === "sign-in"}
          className={mode === "sign-in" ? styles.modeActive : ""}
          disabled={isPending}
          onClick={() => changeMode("sign-in")}
          type="button"
        >
          Đăng nhập
        </button>
        <button
          aria-pressed={mode === "create-account"}
          className={mode === "create-account" ? styles.modeActive : ""}
          disabled={isPending}
          onClick={() => changeMode("create-account")}
          type="button"
        >
          Tạo tài khoản
        </button>
      </div>

      {mode === "sign-in" ? (
        <form className={styles.authForm} onSubmit={submit}>
          <label className={styles.field}>
            <span>Tên đăng nhập hoặc email</span>
            <input
              autoComplete="username"
              maxLength={254}
              minLength={1}
              onChange={(event) => setIdentifier(event.target.value)}
              required
              value={identifier}
            />
          </label>
          <label className={styles.field}>
            <span>Mật khẩu</span>
            <input
              autoComplete="current-password"
              maxLength={128}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <button aria-busy={isPending} className={styles.submitButton} disabled={isPending} type="submit">
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      ) : (
        <p className={styles.emailNote}>
          Tạo tài khoản bằng Google để xác minh email. Sau đó, bạn có thể đặt tên đăng nhập và mật khẩu trong trang tài khoản.
        </p>
      )}

      {mode === "sign-in" ? <p aria-hidden="true" className={styles.divider}><span>hoặc</span></p> : null}
      {mode === "create-account" && error ? <p className={styles.formError} role="alert">{error}</p> : null}

      <div className={styles.googleButtonWrap}>
        <button
          aria-busy={isPending}
          className="button primary is-large expand"
          disabled={isPending}
          onClick={googleSignIn}
          type="button"
        >
          {isPending
            ? "Đang kết nối Google…"
            : mode === "create-account" ? "Tạo tài khoản bằng Google" : "Tiếp tục với Google"}
        </button>
      </div>
    </div>
  );
}
