/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fbyt_clone_vault.json`.
 */
export type FbytCloneVault = {
  "address": "FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais",
  "metadata": {
    "name": "fbytCloneVault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "FBYT Clone Vault Program"
  },
  "instructions": [
    {
      "name": "acceptManager",
      "discriminator": [
        212,
        23,
        254,
        58,
        51,
        238,
        232,
        67
      ],
      "accounts": [
        {
          "name": "pendingManager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "activateVault",
      "discriminator": [
        226,
        220,
        189,
        115,
        9,
        211,
        20,
        118
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "collectFees",
      "discriminator": [
        164,
        152,
        207,
        99,
        30,
        186,
        19,
        182
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "managerTokenAccount",
          "writable": true
        },
        {
          "name": "tokenMint"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": []
    },
    {
      "name": "deactivateVault",
      "discriminator": [
        152,
        132,
        22,
        236,
        200,
        128,
        124,
        174
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "investorTokenAccount",
          "writable": true
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "depositMint",
          "docs": [
            "The mint of the token being deposited (USDC, wSOL, etc.)"
          ]
        },
        {
          "name": "shareTokenMint",
          "writable": true
        },
        {
          "name": "investorShareAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "investor"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "shareTokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeTradePyth",
      "discriminator": [
        91,
        154,
        100,
        57,
        82,
        200,
        57,
        208
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "vaultInputTokenAccount",
          "writable": true
        },
        {
          "name": "vaultInputMint",
          "writable": true
        },
        {
          "name": "vaultOutputTokenAccount",
          "writable": true
        },
        {
          "name": "vaultOutputMint",
          "writable": true
        },
        {
          "name": "priceUpdate"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minAmountOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "manager"
              },
              {
                "kind": "account",
                "path": "shareTokenMint"
              }
            ]
          }
        },
        {
          "name": "depositMint",
          "docs": [
            "The mint of the accepted deposit token (e.g. USDC)"
          ]
        },
        {
          "name": "shareTokenMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram"
        }
      ],
      "args": [
        {
          "name": "minRaiseAmount",
          "type": "u64"
        },
        {
          "name": "performanceFeeBps",
          "type": "u16"
        },
        {
          "name": "managementFeeBps",
          "type": "u16"
        },
        {
          "name": "lockupPeriod",
          "type": "i64"
        },
        {
          "name": "allowedOutputMints",
          "type": {
            "vec": "pubkey"
          }
        }
      ]
    },
    {
      "name": "pauseVault",
      "discriminator": [
        250,
        6,
        228,
        57,
        6,
        104,
        19,
        210
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paused",
          "type": "bool"
        }
      ]
    },
    {
      "name": "setPendingManager",
      "discriminator": [
        141,
        140,
        182,
        240,
        16,
        23,
        219,
        99
      ],
      "accounts": [
        {
          "name": "manager",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "pendingManager",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "investor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault.creator",
                "account": "vaultState"
              },
              {
                "kind": "account",
                "path": "vault.share_token_mint",
                "account": "vaultState"
              }
            ]
          }
        },
        {
          "name": "vaultAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "investorTokenAccount",
          "writable": true
        },
        {
          "name": "withdrawMint",
          "docs": [
            "The mint of the token being withdrawn"
          ]
        },
        {
          "name": "vaultTokenAccount",
          "writable": true
        },
        {
          "name": "shareTokenMint",
          "writable": true
        },
        {
          "name": "investorShareAccount",
          "writable": true
        },
        {
          "name": "tokenProgram"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sharesToBurn",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "vaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "events": [
    {
      "name": "deposited",
      "discriminator": [
        111,
        141,
        26,
        45,
        161,
        35,
        100,
        57
      ]
    },
    {
      "name": "feesCollected",
      "discriminator": [
        233,
        23,
        117,
        225,
        107,
        178,
        254,
        8
      ]
    },
    {
      "name": "managerChanged",
      "discriminator": [
        142,
        97,
        175,
        220,
        73,
        27,
        252,
        56
      ]
    },
    {
      "name": "tradeExecuted",
      "discriminator": [
        41,
        110,
        64,
        129,
        60,
        79,
        179,
        80
      ]
    },
    {
      "name": "vaultActivated",
      "discriminator": [
        76,
        220,
        220,
        110,
        216,
        252,
        88,
        84
      ]
    },
    {
      "name": "vaultDeactivated",
      "discriminator": [
        206,
        142,
        37,
        100,
        98,
        206,
        185,
        157
      ]
    },
    {
      "name": "vaultInitialized",
      "discriminator": [
        180,
        43,
        207,
        2,
        18,
        71,
        3,
        75
      ]
    },
    {
      "name": "vaultPaused",
      "discriminator": [
        198,
        157,
        22,
        151,
        68,
        100,
        162,
        35
      ]
    },
    {
      "name": "withdrawn",
      "discriminator": [
        20,
        89,
        223,
        198,
        194,
        124,
        219,
        13
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Only the vault manager can perform this action"
    },
    {
      "code": 6001,
      "name": "invalidPythFeed",
      "msg": "Invalid Pyth price feed account"
    },
    {
      "code": 6002,
      "name": "mathOverflow",
      "msg": "Math overflow or underflow detected"
    },
    {
      "code": 6003,
      "name": "stalePrice",
      "msg": "Pyth price is too old"
    },
    {
      "code": 6004,
      "name": "vaultLocked",
      "msg": "Vault is not active"
    },
    {
      "code": 6005,
      "name": "minRaiseNotMet",
      "msg": "Minimum raise amount not met"
    },
    {
      "code": 6006,
      "name": "lockupActive",
      "msg": "Withdrawal lockup period has not ended"
    },
    {
      "code": 6007,
      "name": "insufficientVaultBalance",
      "msg": "Insufficient vault balance for withdrawal"
    },
    {
      "code": 6008,
      "name": "invalidTradeParams",
      "msg": "Invalid trade parameters"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6010,
      "name": "feeTooHigh",
      "msg": "Fee exceeds maximum allowed"
    },
    {
      "code": 6011,
      "name": "invalidMint",
      "msg": "Invalid token mint for vault operation"
    },
    {
      "code": 6012,
      "name": "subtractionUnderflow",
      "msg": "Subtraction underflow"
    },
    {
      "code": 6013,
      "name": "multiplicationOverflow",
      "msg": "Multiplication overflow"
    },
    {
      "code": 6014,
      "name": "divisionByZero",
      "msg": "Division by zero"
    },
    {
      "code": 6015,
      "name": "castOverflow",
      "msg": "Type cast overflow"
    },
    {
      "code": 6016,
      "name": "priceConfidenceTooWide",
      "msg": "Price confidence interval is too wide"
    },
    {
      "code": 6017,
      "name": "invalidPriceFeedForMint",
      "msg": "Invalid price feed for token mint"
    },
    {
      "code": 6018,
      "name": "vaultPaused",
      "msg": "Vault is currently paused"
    },
    {
      "code": 6019,
      "name": "shareMintMismatch",
      "msg": "Share token mint mismatch"
    },
    {
      "code": 6020,
      "name": "tooManyOutputMints",
      "msg": "Too many output mints allowed."
    }
  ],
  "types": [
    {
      "name": "deposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "investor",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "sharesMinted",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "navPerShare",
            "type": "u64"
          },
          {
            "name": "totalAssetsAfter",
            "type": "u64"
          },
          {
            "name": "totalSharesAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "feesCollected",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "performanceFee",
            "type": "u64"
          },
          {
            "name": "managementFee",
            "type": "u64"
          },
          {
            "name": "totalCollected",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "managerChanged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "oldManager",
            "type": "pubkey"
          },
          {
            "name": "newManager",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tradeExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "inputMint",
            "type": "pubkey"
          },
          {
            "name": "outputMint",
            "type": "pubkey"
          },
          {
            "name": "amountIn",
            "type": "u64"
          },
          {
            "name": "amountOut",
            "type": "u64"
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "priceExponent",
            "type": "i32"
          },
          {
            "name": "feedId",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "vaultActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultDeactivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "depositMint",
            "type": "pubkey"
          },
          {
            "name": "minRaiseAmount",
            "type": "u64"
          },
          {
            "name": "performanceFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "lockupPeriod",
            "type": "i64"
          },
          {
            "name": "shareTokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "vaultPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "manager",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "docs": [
              "The pubkey the vault PDA is seeded with. Set once at initialize and",
              "never changed, so manager rotation does not orphan the PDA."
            ],
            "type": "pubkey"
          },
          {
            "name": "pendingManager",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "depositMint",
            "type": "pubkey"
          },
          {
            "name": "shareTokenMint",
            "type": "pubkey"
          },
          {
            "name": "minRaiseAmount",
            "type": "u64"
          },
          {
            "name": "performanceFeeBps",
            "type": "u16"
          },
          {
            "name": "managementFeeBps",
            "type": "u16"
          },
          {
            "name": "accruedPerformanceFee",
            "type": "u64"
          },
          {
            "name": "accruedManagementFee",
            "type": "u64"
          },
          {
            "name": "lockupPeriod",
            "type": "i64"
          },
          {
            "name": "totalSharesMinted",
            "type": "u64"
          },
          {
            "name": "totalAssetsDeposited",
            "type": "u64"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          },
          {
            "name": "vaultAuthorityBump",
            "type": "u8"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "vaultStatusCode"
              }
            }
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "lastTradeAt",
            "type": "i64"
          },
          {
            "name": "highWaterMark",
            "type": "u64"
          },
          {
            "name": "lastFeeAccrualAt",
            "type": "i64"
          },
          {
            "name": "allowedOutputMints",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "vaultStatusCode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "fundraising"
          },
          {
            "name": "active"
          },
          {
            "name": "dormant"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    },
    {
      "name": "withdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "investor",
            "type": "pubkey"
          },
          {
            "name": "sharesBurned",
            "type": "u64"
          },
          {
            "name": "amountOut",
            "type": "u64"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "navPerShare",
            "type": "u64"
          },
          {
            "name": "totalAssetsAfter",
            "type": "u64"
          },
          {
            "name": "totalSharesAfter",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
