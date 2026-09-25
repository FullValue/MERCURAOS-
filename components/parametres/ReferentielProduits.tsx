"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { creerFormat, creerParfum, creerProduit, modifierProduit } from "@/app/(app)/parametres/actions";

type Format = { id: string; libelle: string; volumeL: string };
type Parfum = { id: string; nom: string };
type Produit = { id: string; parfumNom: string; formatLibelle: string; sku: string; skuShopify: string | null; actif: boolean };

export function ReferentielProduits({ formats, parfums, produits }: { formats: Format[]; parfums: Parfum[]; produits: Produit[] }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState({ libelle: "", volumeMl: "" });
  const [parfum, setParfum] = useState({ nom: "", prixLiquideL: "" });
  const [produit, setProduit] = useState({ parfumId: "", formatId: "", sku: "", skuShopify: "" });
  const executer = (fn: () => Promise<{ ok: boolean; message: string }>, nettoyer: () => void) => {
    setMessage("");
    demarrer(async () => {
      const resultat = await fn();
      setMessage(resultat.message);
      if (resultat.ok) { nettoyer(); router.refresh(); }
    });
  };
  return <section className="mt-8 border-t border-filet pt-8" aria-labelledby="titre-referentiel">
    <h2 id="titre-referentiel" className="font-titre text-[26px]">Référentiel Mercura</h2>
    <p className="mt-2 text-[13px] text-lecture">Créez les formats, puis les parfums et leurs références commerciales. Le prix du liquide est facultatif à la création et peut ensuite être historisé dans chaque période. Les composants et le façonnage se saisissent séparément pour chaque format.</p>
    <div className="mt-6 grid gap-8 lg:grid-cols-3">
      <form onSubmit={(e) => { e.preventDefault(); executer(() => creerFormat(format), () => setFormat({ libelle: "", volumeMl: "" })); }} className="flex flex-col gap-3">
        <h3 className="border-b border-filet pb-2 text-[16px]">1. Format</h3>
        <label className="etiquette">Libellé<input className="champ mt-1 block w-full" required maxLength={100} value={format.libelle} onChange={(e) => setFormat({ ...format, libelle: e.target.value })} placeholder="Ex. 30 ml" /></label>
        <label className="etiquette">Volume en ml<input className="champ mt-1 block w-full" required inputMode="decimal" value={format.volumeMl} onChange={(e) => setFormat({ ...format, volumeMl: e.target.value })} placeholder="30" /></label>
        <button disabled={enCours} className="bouton-plein self-start">Créer le format</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); executer(() => creerParfum(parfum), () => setParfum({ nom: "", prixLiquideL: "" })); }} className="flex flex-col gap-3">
        <h3 className="border-b border-filet pb-2 text-[16px]">2. Parfum</h3>
        <label className="etiquette">Nom<input className="champ mt-1 block w-full" required maxLength={100} value={parfum.nom} onChange={(e) => setParfum({ ...parfum, nom: e.target.value })} /></label>
        <label className="etiquette">Prix liquide HT / L (facultatif)<input className="champ mt-1 block w-full" inputMode="decimal" value={parfum.prixLiquideL} onChange={(e) => setParfum({ ...parfum, prixLiquideL: e.target.value })} placeholder="À renseigner plus tard" /></label>
        <button disabled={enCours} className="bouton-plein self-start">Créer le parfum</button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); executer(() => creerProduit(produit), () => setProduit({ parfumId: "", formatId: "", sku: "", skuShopify: "" })); }} className="flex flex-col gap-3">
        <h3 className="border-b border-filet pb-2 text-[16px]">3. Référence</h3>
        <label className="etiquette">Parfum<select className="champ mt-1 block w-full" required value={produit.parfumId} onChange={(e) => setProduit({ ...produit, parfumId: e.target.value })}><option value="">Choisir</option>{parfums.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}</select></label>
        <label className="etiquette">Format<select className="champ mt-1 block w-full" required value={produit.formatId} onChange={(e) => setProduit({ ...produit, formatId: e.target.value })}><option value="">Choisir</option>{formats.map((f) => <option key={f.id} value={f.id}>{f.libelle}</option>)}</select></label>
        <label className="etiquette">SKU Mercura<input className="champ mt-1 block w-full" required value={produit.sku} onChange={(e) => setProduit({ ...produit, sku: e.target.value })} /></label>
        <label className="etiquette">SKU Shopify (facultatif)<input className="champ mt-1 block w-full" value={produit.skuShopify} onChange={(e) => setProduit({ ...produit, skuShopify: e.target.value })} /></label>
        <button disabled={enCours || !formats.length || !parfums.length} className="bouton-plein self-start">Créer la référence</button>
      </form>
    </div>
    {message && <p role="status" className="mt-5 text-[13px] text-lecture">{message}</p>}
    {produits.length > 0 && <div className="defile-x mt-8"><table className="tableau min-w-[700px]"><thead><tr><th>Référence</th><th>SKU Mercura</th><th>SKU Shopify</th><th>État</th><th></th></tr></thead><tbody>{produits.map((p) => <LigneProduit key={p.id} produit={p} enCours={enCours} enregistrer={(v) => executer(() => modifierProduit({ id: p.id, ...v }), () => {})} />)}</tbody></table></div>}
  </section>;
}

function LigneProduit({ produit, enCours, enregistrer }: { produit: Produit; enCours: boolean; enregistrer: (v: { sku: string; skuShopify: string; actif: boolean }) => void }) {
  const [sku, setSku] = useState(produit.sku);
  const [skuShopify, setSkuShopify] = useState(produit.skuShopify ?? "");
  const [actif, setActif] = useState(produit.actif);
  return <tr><td>{produit.parfumNom} · {produit.formatLibelle}</td><td><input aria-label={`SKU ${produit.parfumNom} ${produit.formatLibelle}`} className="champ w-[150px]" value={sku} onChange={(e) => setSku(e.target.value)} /></td><td><input aria-label={`SKU Shopify ${produit.parfumNom} ${produit.formatLibelle}`} className="champ w-[150px]" value={skuShopify} onChange={(e) => setSkuShopify(e.target.value)} /></td><td><label className="flex gap-2"><input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> actif</label></td><td><button className="lien-discret" disabled={enCours} onClick={() => enregistrer({ sku, skuShopify, actif })}>enregistrer</button></td></tr>;
}
