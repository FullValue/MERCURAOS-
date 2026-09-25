# Mercura Parfum OS

Application interne de coûts, catalogue, tarifs, clients, commandes, synthèse, imports Excel et synchronisation Shopify. Elle utilise Next.js 15, React 19, Prisma 6, PostgreSQL Supabase, Supabase Auth, Decimal.js, SheetJS et Vitest.

## Démarrage local

Prérequis : Node.js 22.15 ou plus, un projet Supabase **dédié à Mercura**, puis les vrais identifiants de ce projet.

```bash
npm ci
test -e .env || cp .env.example .env
# Renseigner les variables de .env
npm run db:deploy
npm run db:seed
npm run dev
```

Application : http://localhost:3000 ; écran de déverrouillage : http://localhost:3000/connexion. Sans base et Auth configurées, les vérifications de code fonctionnent, mais les pages privées ne peuvent pas charger les données.

## Configuration Supabase

Toutes les variables de `.env.example` concernent le **même** projet Mercura. Ne jamais reprendre une URL, un mot de passe ou une clé d'un autre projet. Dans le tableau de bord Supabase, le bouton **Connect** fournit les hôtes exacts : ne pas déduire l'hôte du pooler depuis la région. Encoder les caractères réservés du mot de passe dans les URL PostgreSQL.

| Variable | Usage |
| --- | --- |
| `DATABASE_URL` | Pooler transactionnel, port 6543, pour l'application ; `pgbouncer=true`, `connection_limit=3`, délais de connexion et de pool bornés. |
| `DIRECT_URL` | Connexion directe PostgreSQL, port 5432, pour `prisma migrate deploy`. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS du projet Mercura. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé **publique** publishable ou anon, utilisée par Supabase Auth. |
| `PIN_COMPTE_EMAIL` | Adresse du compte Supabase Auth réservé au code PIN ; elle reste côté serveur. |
| `PIN_SUFFIXE_SECRET` | Secret aléatoire d'au moins 32 caractères ajouté côté serveur au PIN avant vérification par Supabase Auth. Identique dans tous les environnements. |
| `CHIFFREMENT_CLE` | 32 octets aléatoires en base64 (`openssl rand -base64 32`) pour chiffrer le jeton Shopify. Garder la même clé après déploiement. |
| `SHOPIFY_WEBHOOK_SECRET` | Secret HMAC de l'application Shopify Mercura. |
| `NEXT_PUBLIC_SITE_URL` | URL publique exacte du site, sans slash final. |

`SUPABASE_SERVICE_ROLE_KEY` n'est pas nécessaire au fonctionnement de l'application : la synchronisation du compte PIN passe par la session Auth et Prisma côté serveur. Les clés privées et le jeton Shopify ne sont jamais envoyés au navigateur. `.env` et `.env.local` sont ignorés par Git. Prisma CLI charge `.env` ; Next.js charge aussi `.env.local` si présent.

Le dossier `prisma/migrations/20260925000000_init_mercura` est une **migration initiale complète** pour une base neuve. Les URL de connexion utilisent `schema=mercura` pour isoler les tables métier du schéma `public` exposé par l'API Supabase. Sur un projet neuf, créer au préalable le rôle PostgreSQL applicatif et le schéma `mercura` avec les droits `USAGE, CREATE` pour ce rôle, puis `npm run db:deploy` crée toutes les tables et `_prisma_migrations`. `npm run db:seed` crée les paramètres génériques, le client technique « Boutique en ligne », les deux parfums communiqués (Alabama Cookie et Buffalo Coffee), les formats 50 ml et 2 ml, et leurs quatre déclinaisons. Le seed est idempotent. Il ne crée aucun coût historique, composant, façonnage, tarif ou SKU Shopify. Le prix du liquide à `0` est un marqueur technique « non renseigné » : le catalogue affiche « à chiffrer » tant qu'un vrai prix n'est pas saisi.

Exécuter une fois dans le SQL Editor du **projet Mercura** avec un mot de passe aléatoire réservé à ce rôle :

```sql
CREATE ROLE mercura_app LOGIN PASSWORD 'REMPLACER_PAR_UN_SECRET_ALEATOIRE';
CREATE SCHEMA mercura;
GRANT USAGE, CREATE ON SCHEMA mercura TO mercura_app;
GRANT CONNECT, CREATE ON DATABASE postgres TO mercura_app;
```

Utiliser ce mot de passe dans les deux URL de `.env`. Le droit `CREATE` sur la base permet aussi le schéma temporaire des tests d'intégration. La base Mercura configurée dans cet espace de travail a déjà reçu ce rôle, ce schéma et la migration ; les commandes SQL ci-dessus documentent une installation sur un autre projet neuf.

Pour le premier accès, créer dans **Supabase Auth → Users** un compte avec l'adresse `PIN_COMPTE_EMAIL`, confirmer son e-mail, et donner comme mot de passe la concaténation exacte du PIN choisi puis de `PIN_SUFFIXE_SECRET`, sans espace. Le visiteur ne saisit **que le PIN** sur `/connexion` ; le suffixe et l'adresse ne sont jamais envoyés au navigateur. Supabase Auth conserve la session dans des cookies serveur. Seul ce compte est accepté par le middleware et les Server Actions. Les essais sont limités dans PostgreSQL à cinq par origine et trente au total par fenêtre de quinze minutes. La ligne `Utilisateur` est créée au premier accès. Pour changer le PIN, modifier le mot de passe de ce compte Auth avec la nouvelle concaténation.

## Saisie des vraies données Mercura

1. **Registre des coûts → Référentiel Mercura** : les deux parfums et quatre déclinaisons sont déjà créés. Les SKU internes provisoires (`ALABAMA-COOKIE-50ML`, `ALABAMA-COOKIE-2ML`, `BUFFALO-COFFEE-50ML`, `BUFFALO-COFFEE-2ML`) sont modifiables ; renseigner les SKU Shopify officiels avant de synchroniser la boutique. On peut ajouter d'autres formats et parfums sans connaître encore leur prix liquide.
2. Créer une période datée dans le registre. Renseigner le prix du liquide et le façonnage **pour chacune des quatre références parfum × format** : Alabama Cookie 50 ml, Alabama Cookie 2 ml, Buffalo Coffee 50 ml et Buffalo Coffee 2 ml. Les libellés « Prix du liquide par parfum » et « Façonnage » sont conservés ; chaque tableau comporte une ligne par référence. Saisir séparément pour les formats 2 ml et 50 ml les composants communs (flacon, packaging, etc.), leurs coûts HT/TTC et quantités. Ajouter ensuite le taux de perte, la livraison, les coûts variables fournisseur et la TVA récupérable. Aucun de ces coûts n'a été inventé dans le seed.
3. Vérifier les coûts dans le catalogue et le simulateur. Ajouter les clients, les prix clients datés et la grille tarifaire commerciale par rôle. Créer ensuite les commandes ou importer les fichiers Excel avec les modèles téléchargeables de `/import`.

Les données métier ne sont jamais écrites dans le code. Les commandes confirmées figent leur coût unitaire ; une réouverture explicite permet de les recalculer et de les reconfirmer. Une commande rouverte sort de la synthèse jusqu'à confirmation.

## Shopify

Créer une application privée/custom app pour la boutique Mercura avec `read_orders` (et `read_all_orders` si l'historique au-delà de 60 jours est nécessaire). Dans **Réglages**, saisir le domaine `*.myshopify.com`, le jeton Admin API, puis tester la connexion et lancer une synchronisation. Le jeton est chiffré AES-256-GCM en base et n'est jamais réaffiché. Configurer les webhooks `orders/create` et `orders/updated` vers `${NEXT_PUBLIC_SITE_URL}/api/shopify/webhook`, avec le secret HMAC dans `SHOPIFY_WEBHOOK_SECRET`. Les SKU inconnus restent dans la file de rapprochement et les commandes incomplètes ne sont pas comptées dans la synthèse. La commission par défaut est de 1,4 % + 0,25 € et se règle dans l'application.

## Validation et déploiement

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration # nécessite DIRECT_URL valide ; schéma PostgreSQL temporaire
```

Les tests d'intégration créent puis suppriment un schéma `mercura_test_*` isolé. Ils ne doivent être lancés que sur le projet Mercura. Les vérifications de code et les tests unitaires ne nécessitent pas de connexion externe.

Pour Vercel, créer un **nouveau** projet associé à ce dépôt, configurer les mêmes variables, y compris `PIN_COMPTE_EMAIL` et `PIN_SUFFIXE_SECRET`, dans les environnements concernés, lancer les migrations avec `DIRECT_URL` avant le premier trafic, puis déployer. Configurer `NEXT_PUBLIC_SITE_URL` avec l'URL Vercel finale et l'ajouter aux redirections Supabase Auth. Ne pas relier ce dossier au projet Vercel d'une autre marque.
