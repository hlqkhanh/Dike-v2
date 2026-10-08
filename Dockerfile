# syntax=docker/dockerfile:1
FROM eclipse-temurin:21-jdk-jammy AS build

WORKDIR /workspace
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY apps/backend/pom.xml apps/backend/pom.xml
RUN chmod +x mvnw && ./mvnw -B -ntp -pl apps/backend -am dependency:go-offline

COPY apps/backend/src apps/backend/src
RUN ./mvnw -B -ntp -pl apps/backend -am package -DskipTests

FROM eclipse-temurin:21-jre-jammy AS runtime

ARG DIKE_SERVICE_VERSION=dev
LABEL org.opencontainers.image.title="Dike Backend" \
      org.opencontainers.image.version="${DIKE_SERVICE_VERSION}" \
      org.opencontainers.image.source="https://github.com/hlqkhanh/Dike-v2"

RUN groupadd --system --gid 10001 dike \
    && useradd --system --uid 10001 --gid dike --home-dir /app --shell /usr/sbin/nologin dike

WORKDIR /app
COPY --from=build --chown=dike:dike /workspace/apps/backend/target/dike-backend-0.0.1-SNAPSHOT.jar app.jar

USER 10001:10001
EXPOSE 8080
ENV DIKE_SERVICE_VERSION=${DIKE_SERVICE_VERSION} \
    JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -Dfile.encoding=UTF-8"

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

