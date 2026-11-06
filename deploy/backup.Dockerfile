FROM postgres:17-alpine
RUN apk add --no-cache restic openssh-client bash jq
COPY scripts/ops/backup.sh /usr/local/bin/tax-backup
ENTRYPOINT ["bash","/usr/local/bin/tax-backup"]
