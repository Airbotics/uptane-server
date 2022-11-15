# a basic image that installs ostree on top of ubuntu, used for manual testing

FROM ubuntu:20.04

RUN apt update && apt install -y ostree

CMD ["/bin/bash"]