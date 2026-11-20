import RoomApp from "@/components/RoomApp";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomApp roomId={id} />;
}
