import ResetPasswordClient from "./ResetPasswordClient";

type PageProps = {
  searchParams?: {
    workerId?: string;
  };
};

export default function ResetPasswordPage({ searchParams }: PageProps) {
  const workerId =
    typeof searchParams?.workerId === "string"
      ? Number(searchParams.workerId)
      : null;

  return <ResetPasswordClient initialWorkerId={workerId} />;
}