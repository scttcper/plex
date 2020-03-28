FROM plexinc/pms-docker
run mkdir /data/movies
run mkdir /data/shows
COPY --chown=plex ./movies /data/movies
COPY --chown=plex ./shows /data/shows
RUN chown -R plex:users /data
