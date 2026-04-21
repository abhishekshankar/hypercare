import { ScreenHeader } from "@/components/screen-header";

type Props = Readonly<{
  searchParams: Promise<{ reason?: string }>;
}>;

export default async function AuthErrorPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  return (
    <>
      <ScreenHeader
        subHeadline={
          reason
            ? `Something went wrong during sign-in (${reason}). Try again, or use Help for crisis resources.`
            : "Something went wrong during sign-in. Try again, or use Help for crisis resources."
        }
        title="Sign-in error"
      />
      <p className="text-muted-foreground">
        Full error handling ships in TASK-006. The crisis strip above is always available.
      </p>
    </>
  );
}
