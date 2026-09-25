import Link from "next/link";
export default function Introuvable() {
  return <div><h1 className="font-titre text-[32px]">Élément introuvable</h1><p className="mt-4">Il a peut-être été supprimé.</p><Link href="/commandes" className="lien-discret mt-6 inline-block">Retour aux commandes</Link></div>;
}
