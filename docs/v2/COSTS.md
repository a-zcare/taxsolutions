# Capacity and operating budget

Planning estimate for a small practice, not a provider quotation or a purchase authorization. Start with an EU VPS, 2 vCPU / 4 GB RAM / 40 GB SSD for low-volume runtime. Prefer 4 vCPU / 8 GB if building images on the VPS or retaining significant audit/task history. Measure database size, request latency and worker lag before scaling. This single-host arrangement is not highly available.

Allow approximately EUR 10–25/month before VAT for a small VPS plus independently hosted encrypted backups and low-volume email; domain, VAT, IPv4, extra storage/traffic and video licenses may add costs. Backup destination must be separate from the primary VPS. Existing SMTP/backup services may lower incremental cost, but do not count them as free without confirming quotas and processor terms. No AI API cost exists. Free/open-source software does not make infrastructure, operations or video hosting free.

As one reference, Hetzner's June 2026 official adjustment lists EU CX23 at EUR 5.49/month excluding VAT; availability, IPv4 and current checkout price must be checked before ordering: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/ . This is a reference point, not a claim that the whole platform costs EUR 5.49. No service has been ordered.

External activation work: domain/DNS authorization; EU VPS account and SSH; SMTP sender verification/SPF/DKIM/DMARC; independent backup destination; Google/Microsoft/Zoom developer apps and host entitlements only for providers actually chosen. Keep all credentials outside Git. Operators must budget time for security updates, restore drills and access reviews.
