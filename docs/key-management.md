# Key management

## Limitations

The following limitations are likely be addressed over time:

- Symmetric keys are not used.

- Only uses online keys.

- No support for key revocation.

- Only supports RSA keys.

- Only one key per role per repository.


## Storage

There are several options for where online keys can be stored. Which providers is chosen is configurable.

Avaialable providers:

- Local filesystem: stores keys in plaintext in local hidden directory. This should not be used in production, but it's handy for development.