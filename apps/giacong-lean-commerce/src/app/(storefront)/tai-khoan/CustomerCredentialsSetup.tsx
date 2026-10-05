"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { customerAuthClient } from "@/lib/customer-auth-client";

import { setCustomerAccountPassword } from "./actions";
import styles from "./customer-credentials.module.css";

function getErrorCode(result: unknown): string {
  if (typeof result !== "object" || result === null || !("error" in result)) return "";
  const error = result.error;
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : "";
}

export function CustomerCredentialsSetup({
  initialUsername,
  hasPassword,
}: {
  initialUsername: string | null;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername ?? "");
  const [usernameSaved, setUsernameSaved] = useState(Boolean(initialUsername));
  const [password, setPassword] = useState("");
  const [passwordSaved, setPasswordSaved] = useState(hasPassword);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (usernameSaved && passwordSaved) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;

    setIsPending(true);
    setError("");
    setNotice("");

    try {
      if (!usernameSaved) {
        const result = await customerAuthClient.updateUser({ username: username.trim() });
        const code = getErrorCode(result);
        if (code) {
          setError(code.toLowerCase().includes("username")
            ? "Tên đăng nhập này đã được dùng. Hãy chọn tên khác."
            : "Không thể lưu tên đăng nhập. Hãy kiểm tra lại rồi thử tiếp.");
          return;
        }
        setUsernameSaved(true);
      }

      if (!passwordSaved) {
        const result = await setCustomerAccountPassword(password);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setPasswordSaved(true);
        setPassword("");
      }

      setNotice("Đã tạo thông tin đăng nhập. Lần sau bạn có thể dùng tên đăng nhập và mật khẩu.");
      router.refresh();
    } catch {
      setError("Chưa thể lưu thông tin đăng nhập. Vui lòng thử lại.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Thêm cách đăng nhập bằng mật khẩu <span>(tùy chọn)</span></summary>
      <p>Bạn đã đăng nhập bằng Google. Thêm thông tin này để lần sau đăng nhập nhanh hơn.</p>
      <form className={styles.form} onSubmit={submit}>
        {!usernameSaved ? (
          <label className={styles.field}>
            <span>Tên đăng nhập</span>
            <input
              autoComplete="username"
              maxLength={30}
              minLength={3}
              onChange={(event) => setUsername(event.target.value)}
              pattern="[A-Za-z0-9_]+"
              required
              title="Dùng chữ không dấu, số hoặc gạch dưới."
              value={username}
            />
          </label>
        ) : null}
        {!passwordSaved ? (
          <label className={styles.field}>
            <span>Mật khẩu</span>
            <input
              autoComplete="new-password"
              maxLength={128}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <small>Ít nhất 8 ký tự.</small>
          </label>
        ) : null}
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        <button className={styles.submit} disabled={isPending} type="submit">
          {isPending ? "Đang lưu…" : "Lưu thông tin đăng nhập"}
        </button>
      </form>
      <p className={styles.help}>Bạn vẫn có thể đăng nhập bằng Google nếu không dùng mật khẩu.</p>
    </details>
  );
}
