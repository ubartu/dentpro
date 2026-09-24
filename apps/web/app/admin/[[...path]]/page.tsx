import Portal from "../../components/Portal";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path = [] } = await params;
  return (
    <Portal role="admin" section={path[0] || "overview"} entityId={path[1]} />
  );
}
