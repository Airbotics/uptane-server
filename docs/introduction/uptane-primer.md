# Uptane primer

[Uptane](https://uptane.github.io/) is an extension of [The Update Framework](https://theupdateframework.com/) (TUF) designed for securing software update systems in the automotive industry. It was initially developed by a consortium of industry, academic and goverment agencies under a grant from the U.S. Department of Homeland Security. Popular Science named Uptane one of the [Top Security Inventions of 2017](https://www.popsci.com/top-security-innovations-2017/), and since 2019 is has been formally affiliated with the Linux Foundation as a [Joint Development Foundation](https://jointdevelopment.org/) project. 


Uptane is integrated into [Automotive Grade Linux](https://www.automotivelinux.org/) is used by about 1/3 of new cars on US roads [[1]]([](https://events19.linuxfoundation.org/wp-content/uploads/2018/07/Uptane-2019-Summer-AGL-event.pdf)). TUF is used to secure millions of system and has been adopted by Docker Content Trust, PyPI, Datadog, and many others.


## The Update Framework

Uptane is an extension of The Update Framework - a specification for securing software update systems - designed around the following principles:

### Separation of trust

TUF was designed to address limitations found in some software update systems whereby: all trust is placed in a single party or key, trust is uniformly granted to all parties, and trust is granted to a party indefinitely without expiration.

### Key compromise resilience

TUF does not assume that keys will forever remain safe from comprise, instead it provides mechanisms for fast and secure key replacement and revocation.

### Integrity

TUF requires that clients must verify the integrity of files they've downloaded as well as the integrity of the repository as a whole.

### Freshness

Software updates often fix security vulnerabilities, attackers may want to keep clients running old versions to exploit known vulnerabilities or tricking them into thinking there is no new update available. TUF ensures freshness by requiring that clients do not accept files older than those that have been seen previously and allowing them to recognize when there may be a problem obtaining new updates.


## Uptane

Uptane builds on TUF in a few key ways:

- It introduces a director repository to 

- It provides mechanisms for updating multiple ECUs together.


## Diving deeper

The authoritative source of information for both specifications are their websites:

- [Uptane](https://uptane.github.io/)

- [The Update Framework](https://theupdateframework.io/)