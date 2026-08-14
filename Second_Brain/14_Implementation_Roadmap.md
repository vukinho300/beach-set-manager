# Implementation Roadmap

Status: `prototype_decision`

1. Freeze Phase 0 architecture: tenant, roles, transaction ownership, environments, sync/conflict rules.
2. Introduce service/repository boundaries without changing behavior.
3. Create the development backend project and schema migrations.
4. Add authentication for Vuk and Vito plus Petalon membership and RLS.
5. Migrate Beaches + Beds as the first shared slice.
6. Add realtime subscriptions and server-side concurrency checks.
7. Build a controlled import path from current localStorage/JSON backup data.
8. Migrate reservations, transactions, Sunbeds and Aquapark.
9. Move business-day/reset behavior to server-owned logic and add audit history.
10. Create a separate production environment and prepare the Petalon commercial pilot.
11. During production preparation, finalize the product brand, purchase the frontend domain, connect it to Vercel and verify production DNS/TLS. The domain is not a blocker for steps 1–9. Do not add a paid Supabase custom API domain unless a real requirement has appeared. See [[17_Domain_and_Production_Branding]].
12. Add seasonal licensing, session-seat limits, white-label config and private platform administration.
13. Run offline-sync experiments, then implement IndexedDB outbox/conflict handling if approved.
14. Harden backup/restore, monitoring and security before commercial launch.
15. Add Viva/NeoSalon/Marketino adapters only in a later phase.
