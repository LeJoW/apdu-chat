# MIFARE Classic Support (7.15)

Pour activer la lecture et l’écriture des blocks classiques via l’interface DESFire, il faut

1. créer une application avec le support classique
2. créer un fichier avec le support classique dans l’application
3. activer la clé de licence `KeyID.MFCLicenseMACKey` (ou connaître la clé si déjà activée)
4. associer les blocks voulus au fichier créé

Les APDU donnés sont des exemples. Voir la doc.

## 1. Création de l’application

> `Cmd.CreateApplication` (7.6.1.1)

```diff
> 90 CA 00 00 06 01 02 03 0F 11 08 00
```

## 2. Création du fichier

> `Cmd.SelectApplication` (7.6.3.2)

```diff
> 90 5A 00 00 03 01 02 03 00
91 00
```

> `Cmd.CreateStdDataFile` (7.7.4.1)

> **Warning** La taille du fichier doit être suffisante pour contenir les blocks à associer.

```diff
> 90 CD 00 00 07 01 A1 EE EF 04 00 00 00
91 00
```

## 3. Activation de la clé de licence (7.5.4.1.5)

> `Cmd.ChangeKey` (7.5.6.1)

| Commande     |                               | longueur |
| ------------ | ----------------------------- | -------- |
| `Cmd`        | 0xC4                          | 1        |
| `KeyNo`      | 0x32                          | 1        |
| `Cryptogram` | E($K_{SesAuth}$, $plaintext$) | 32       |

$plaintext = (NewKey \oplus OldKey) | KeyVer | CRC32 | CRC32NK$

| Cryptogram |                                                                | longueur |
| ---------- | -------------------------------------------------------------- | -------- |
| NewKey     |                                                                | 16       |
| OldKey     | $0b0^{128}$                                                    | 16       |
| KeyVer     | 0x00                                                           | 1        |
| CRC32      | CRC32( $ 0xC4  \| 0x32 \| (NewKey \oplus OldKey) \| KeyVer $ ) | 4        |
| CRC32NK    | CRC32(NewKey)                                                  | 4        |

## 4. Association des blocks classiques

> `Cmd.SelectApplication` (7.6.3.2)

> `Cmd.CreateMFCMapping` (7.15.3.2)

> **Warning** Cette commande utilise `CommMode.Full`. Voir la section `Option a: Encryption on command` de la figure 15.

| Commande        |                                                                    |                | longueur |
| --------------- | ------------------------------------------------------------------ | -------------- | -------- |
| `Cmd`           | 0xCF                                                               |                | 1        |
| `FileNo`        |                                                                    |                | 1        |
| `FileOption`    | 0x00                                                               |                | 1        |
| `MFCBlocksLen`  | nombre $N$ de blocks à associer                                    |                | 1        |
| `MFCBlockList`  | liste des $N$ blocks en question                                   |                | N        |
| `MFCLicense`    | $N$ \| Block $i$ \| BlockOption $i$                                | $i \in [1, N]$ | 1 + 2N   |
| `MFCLicenseMAC` | $\text{MAC-AES}_t(KMFCLicenseMAC, 0x01\|MFCLicense\|MFCSectorSecrets)$ |                | 8        |

| MFCLicense      |                                          | longueur |
| --------------- | ---------------------------------------- | -------- |
| Block $i$       | $4 \times \text{secteur} + \text{block}$ | 1        |
| BlockOption $i$ | 0x01                                     | 1        |

**MFCSectorSecrets** (sec. 7.15.3.2.2)

```sh
function getSector(BlockNrX)
    return (sector number of BlockNrX)
end function

function getSectorSecret(BlockNrX)
    if [keyB can be read by keyA] then
        return KeyA
    else
        return KeyA|KeyB
    end if
end function

MFCSectorSecrets = ''
for X=1 to N do
    if X==1 then
        MFCSectorSectrets = MFCSectorSectrets || getSectorSecret(BlockNrX)
    else if getSector(BlockNrX) != getSector(BlockNr(X-1)) then
        MFCSectorSectrets = MFCSectorSectrets || getSectorSecret(BlockNrX)
    end if
end for
```
