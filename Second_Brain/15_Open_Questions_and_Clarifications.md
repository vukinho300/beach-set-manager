# Open Questions and Clarifications

Status: `canonical`

Resolve these before implementation begins:

1. First login method: recommendation is email/password for Vuk and Vito unless Vuk prefers magic-link/OTP.
2. First roles: should Vuk be both PLATFORM_OWNER and a Petalon WORKER membership? Recommendation: yes, keep platform authority separate from location membership.
3. First pilot users: recommendation is Vuk + Vito only; add Mark after shared-state behavior is proven.
4. Initial data: recommendation is start the development database with controlled fixture/import data, not silently move current production-browser localStorage.
5. Petalon timezone: confirm `Europe/Zagreb` as the business-day timezone.
6. Offline scope: recommendation is design now but do not allow offline financial/operational writes in the first shared milestone.
7. Daily Reset: decide whether server-side business-day close is included in the first full backend migration or immediately after the first shared Beach/Bed slice; recommendation is before any real multi-user production pilot.
8. Second Brain location: it currently lives in `Second_Brain/` inside the application repository. Move it to a separate repository later only if Vuk explicitly prefers that workflow.
