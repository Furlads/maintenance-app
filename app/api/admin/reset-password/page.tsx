"use client";

import { useEffect, useState } from "react";

type Worker = {
id: number;
firstName: string;
lastName: string;
email: string;
};

export default function ResetPasswordPage() {
const [workers, setWorkers] = useState<Worker[]>([]);
const [selectedWorker, setSelectedWorker] = useState<number | null>(null);
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");

useEffect(() => {
fetch("/api/workers")
.then((res) => res.json())
.then((data) => setWorkers(data));
}, []);

const handleReset = async () => {
if (!selectedWorker || !password) {
setMessage("Please select a worker and enter a password");
return;
}

```
const res = await fetch("/api/admin/reset-password", {
  method: "POST",
  body: JSON.stringify({
    workerId: selectedWorker,
    newPassword: password,
  }),
});

const data = await res.json();

if (data.success) {
  setMessage("✅ Password reset successfully");
  setPassword("");
} else {
  setMessage("❌ Failed to reset password");
}
```

};

return (
<div style={{ padding: 20 }}> <h1>Reset Worker Password</h1>

```
  <select
    onChange={(e) => setSelectedWorker(Number(e.target.value))}
    style={{ display: "block", marginBottom: 10 }}
  >
    <option value="">Select worker</option>
    {workers.map((w) => (
      <option key={w.id} value={w.id}>
        {w.firstName} {w.lastName} ({w.email})
      </option>
    ))}
  </select>

  <input
    type="password"
    placeholder="New password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={{ display: "block", marginBottom: 10 }}
  />

  <button onClick={handleReset}>Reset Password</button>

  <p>{message}</p>
</div>
```

);
}
