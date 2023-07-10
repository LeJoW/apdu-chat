# apdu-chat

> Dialogue au format APDU avec une carte via `pcsc`

## Installation

1. prérequis (windows/macOS)

    - `nodejs v20.30.0`

2. installation
    - `git clone 'https://github.com/LeJoW/apdu-chat.git'`
    - `cd apdu-chat`
    - `npm i`

## Utilisation

On entre dans l’invite de commande via `./apdu-chat.js`.

Le principe de fonctionnement est assez simple&nbsp;:

-   si le programme reconnaît une commande, il l’exécute
-   sinon, il interprète la ligne comme une commande APDU à envoyer à la carte

### Liste des commandes disponibles&nbsp;:

| commande          | paramètres                | description                                               |
| ----------------- | ------------------------- | --------------------------------------------------------- |
| `l`               | —                         | liste les commandes disponibles                           |
| `exit`            | —                         | quitte le programme                                       |
| `close`           | —                         | ferme l’authentification de la carte                      |
| `vars`            | —                         | liste les variables enregistrées                          |
| `set`             | nom, valeur               | enregistre une variable                                   |
| `key`             | clé                       | enregistre la clé de (dé)cryptage dans les variables      |
| `iv`              | iv                        | enregistre le vecteur initial dans les variables          |
| `dec`             | message                   | décrypte le message via 3DES-CBC (clé, iv enregistrés)    |
| `enc`             | message                   | crypte le message via 3DES-CBC (clé, iv enregistrés)      |
| `mac`             | message                   | calcul le MAC du message (3DES-CBC — clé, iv enregistrés) |
| `crc32`           | message                   | calcul le CRC32 du message                                |
| `random`          | taille                    | donne un nombre aléatoire de la taille (en bits)          |
| `format`          | —                         | affiche le format APDU pour EV3C (sec. 7.10.1)            |
| `authenticateISO` | PMK (nulle si non donnée) | exécute la commande authenticateISO (sec. 7.3.9.3) en EV1 |
| `readers`         | —                         | affiche la liste des lecteurs connectés                   |
| `select`          | étiquette du lecteur      | sélectionne le lecteur donné                              |
| `r`               | —                         | affiche le lecteur selectionné                            |

### Exemple

> récupère l’uid d’une carte via `Cmd.GetVersion` (7.4.2.1)

```
13:43 > readers
r0   : HID Global OMNIKEY 5022 Smart Card Reader
13:43 > select r0
13:43 HID Global OMNIKEY 5022 Smart Card Reader % 90 60 00 00 00
04 01 01 12 00 1A 05 91 AF
13:44 HID Global OMNIKEY 5022 Smart Card Reader % 90 AF 00 00 00
04 01 01 02 01 1A 05 91 AF
13:44 HID Global OMNIKEY 5022 Smart Card Reader % 90 AF 00 00 00
04 3A 21 92 EB 5A 80 CE 6A 16 4D 82 40 17 91 00
$\color{green}{test}$
```

L’uid est ici `04 3A 21 92 EB 5A 80` (dernière ligne).

## Note sur les APDU pour EV3C&nbsp;:

-   il faut faire attention au mode de communication de la commande indiqué dans la description de la commande par `CommMode`
    et expliqué aux sections 7.3.9.6-8
-   dans les tables des modes de communication, les couleurs correspondent aux couleurs du tableau de la commande
    et pas aux couleurs du format APDU
-   les champs d’en-tête des commandes (`CmdHeader` en jaunes) sont à écrire en inversant l’ordre des octets (champs LSB, sec. 7.3.1.1)
