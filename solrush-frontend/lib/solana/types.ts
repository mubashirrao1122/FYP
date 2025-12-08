/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solrush_dex.json`.
 */
export type SolrushDex = {
  "address": "HiBkUd2QX61NNJkAwU48EadUs9HDgKnbDFJ3Zoq6uFMp",
  "metadata": {
    "name": "solrushDex",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addLiquidity",
      "discriminator": [
        181,
        157,
        89,
        67,
        143,
        182,
        52,
        72
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "lpTokenMint",
          "writable": true
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "tokenAVault",
          "writable": true
        },
        {
          "name": "tokenBVault",
          "writable": true
        },
        {
          "name": "userTokenA",
          "writable": true
        },
        {
          "name": "userTokenB",
          "writable": true
        },
        {
          "name": "userLpTokenAccount",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amountA",
          "type": "u64"
        },
        {
          "name": "amountB",
          "type": "u64"
        },
        {
          "name": "minLpTokens",
          "type": "u64"
        }
      ]
    },
    {
      "name": "calculatePendingRewards",
      "discriminator": [
        56,
        207,
        218,
        85,
        139,
        115,
        80,
        43
      ],
      "accounts": [
        {
          "name": "position"
        },
        {
          "name": "pool"
        },
        {
          "name": "rushConfig"
        },
        {
          "name": "user",
          "signer": true
        }
      ],
      "args": [],
      "returns": "u64"
    },
    {
      "name": "cancelLimitOrder",
      "discriminator": [
        132,
        156,
        132,
        31,
        67,
        40,
        232,
        97
      ],
      "accounts": [
        {
          "name": "limitOrder",
          "writable": true
        },
        {
          "name": "orderVault",
          "writable": true
        },
        {
          "name": "userTokenIn",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimRushRewards",
      "discriminator": [
        214,
        101,
        86,
        179,
        137,
        158,
        23,
        51
      ],
      "accounts": [
        {
          "name": "position",
          "writable": true
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "rushConfig",
          "writable": true
        },
        {
          "name": "rushMint",
          "writable": true
        },
        {
          "name": "userRushAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
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
                "path": "rushMint"
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
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "args": []
    },
    {
      "name": "createLimitOrder",
      "discriminator": [
        76,
        161,
        70,
        122,
        82,
        20,
        142,
        75
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "limitOrder",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  109,
                  105,
                  116,
                  95,
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "arg",
                "path": "orderId"
              }
            ]
          }
        },
        {
          "name": "sellTokenMint"
        },
        {
          "name": "userTokenIn",
          "writable": true
        },
        {
          "name": "userTokenOut",
          "writable": true
        },
        {
          "name": "orderVault",
          "writable": true,
          "signer": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sellAmount",
          "type": "u64"
        },
        {
          "name": "targetPrice",
          "type": "u64"
        },
        {
          "name": "minimumReceive",
          "type": "u64"
        },
        {
          "name": "expiryDays",
          "type": "i64"
        },
        {
          "name": "orderId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeLimitOrder",
      "discriminator": [
        52,
        33,
        60,
        30,
        47,
        100,
        40,
        22
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "limitOrder",
          "writable": true
        },
        {
          "name": "orderVault",
          "writable": true
        },
        {
          "name": "poolVaultIn",
          "writable": true
        },
        {
          "name": "userTokenOut",
          "writable": true
        },
        {
          "name": "poolVaultOut",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "initializePool",
      "discriminator": [
        95,
        180,
        10,
        172,
        84,
        174,
        232,
        40
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "tokenAMint"
              },
              {
                "kind": "account",
                "path": "tokenBMint"
              }
            ]
          }
        },
        {
          "name": "tokenAMint"
        },
        {
          "name": "tokenBMint"
        },
        {
          "name": "lpTokenMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              }
            ]
          }
        },
        {
          "name": "tokenAVault",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenBVault",
          "writable": true,
          "signer": true
        },
        {
          "name": "lpTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "authority"
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
                "path": "lpTokenMint"
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
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeRushToken",
      "discriminator": [
        240,
        162,
        50,
        178,
        129,
        215,
        170,
        144
      ],
      "accounts": [
        {
          "name": "rushConfig",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  117,
                  115,
                  104,
                  95,
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "rushMint",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "marketBuy",
      "discriminator": [
        90,
        236,
        106,
        220,
        221,
        81,
        108,
        140
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "userTokenIn",
          "writable": true
        },
        {
          "name": "userTokenOut",
          "writable": true
        },
        {
          "name": "poolVaultIn",
          "writable": true
        },
        {
          "name": "poolVaultOut",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountBIn",
          "type": "u64"
        },
        {
          "name": "minAReceived",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "marketSell",
      "discriminator": [
        11,
        224,
        159,
        119,
        129,
        127,
        145,
        237
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "userTokenIn",
          "writable": true
        },
        {
          "name": "userTokenOut",
          "writable": true
        },
        {
          "name": "poolVaultIn",
          "writable": true
        },
        {
          "name": "poolVaultOut",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountAIn",
          "type": "u64"
        },
        {
          "name": "minBReceived",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "pauseRushRewards",
      "discriminator": [
        124,
        156,
        220,
        127,
        0,
        42,
        225,
        64
      ],
      "accounts": [
        {
          "name": "rushConfig",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "removeLiquidity",
      "discriminator": [
        80,
        85,
        209,
        72,
        24,
        206,
        177,
        108
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "lpTokenMint",
          "writable": true
        },
        {
          "name": "userPosition",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "pool"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "tokenAVault",
          "writable": true
        },
        {
          "name": "tokenBVault",
          "writable": true
        },
        {
          "name": "userLpTokenAccount",
          "writable": true
        },
        {
          "name": "userTokenA",
          "writable": true
        },
        {
          "name": "userTokenB",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "lpTokensToBurn",
          "type": "u64"
        },
        {
          "name": "minAmountA",
          "type": "u64"
        },
        {
          "name": "minAmountB",
          "type": "u64"
        }
      ]
    },
    {
      "name": "swap",
      "discriminator": [
        248,
        198,
        158,
        145,
        225,
        117,
        135,
        200
      ],
      "accounts": [
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "userTokenIn",
          "writable": true
        },
        {
          "name": "userTokenOut",
          "writable": true
        },
        {
          "name": "poolVaultIn",
          "writable": true
        },
        {
          "name": "poolVaultOut",
          "writable": true
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amountIn",
          "type": "u64"
        },
        {
          "name": "minimumAmountOut",
          "type": "u64"
        },
        {
          "name": "isAToB",
          "type": "bool"
        },
        {
          "name": "deadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "updateRushApy",
      "discriminator": [
        17,
        148,
        68,
        101,
        127,
        186,
        119,
        147
      ],
      "accounts": [
        {
          "name": "rushConfig",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newApy",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "limitOrder",
      "discriminator": [
        137,
        183,
        212,
        91,
        115,
        29,
        141,
        227
      ]
    },
    {
      "name": "liquidityPool",
      "discriminator": [
        66,
        38,
        17,
        64,
        188,
        80,
        68,
        129
      ]
    },
    {
      "name": "rushConfig",
      "discriminator": [
        84,
        79,
        197,
        243,
        74,
        243,
        89,
        223
      ]
    },
    {
      "name": "userLiquidityPosition",
      "discriminator": [
        220,
        156,
        226,
        70,
        90,
        4,
        201,
        39
      ]
    }
  ],
  "events": [
    {
      "name": "limitOrderCancelled",
      "discriminator": [
        244,
        219,
        115,
        91,
        20,
        209,
        47,
        209
      ]
    },
    {
      "name": "limitOrderCreated",
      "discriminator": [
        90,
        152,
        6,
        18,
        137,
        223,
        10,
        110
      ]
    },
    {
      "name": "limitOrderExecuted",
      "discriminator": [
        230,
        96,
        79,
        110,
        208,
        225,
        214,
        243
      ]
    },
    {
      "name": "liquidityAdded",
      "discriminator": [
        154,
        26,
        221,
        108,
        238,
        64,
        217,
        161
      ]
    },
    {
      "name": "liquidityRemoved",
      "discriminator": [
        225,
        105,
        216,
        39,
        124,
        116,
        169,
        189
      ]
    },
    {
      "name": "poolCreated",
      "discriminator": [
        202,
        44,
        41,
        88,
        104,
        220,
        157,
        82
      ]
    },
    {
      "name": "rewardsClaimed",
      "discriminator": [
        75,
        98,
        88,
        18,
        219,
        112,
        88,
        121
      ]
    },
    {
      "name": "rewardsConfigUpdated",
      "discriminator": [
        104,
        85,
        46,
        239,
        155,
        224,
        9,
        57
      ]
    },
    {
      "name": "rewardsPaused",
      "discriminator": [
        127,
        0,
        46,
        254,
        176,
        222,
        51,
        158
      ]
    },
    {
      "name": "rushTokenInitialized",
      "discriminator": [
        96,
        232,
        1,
        153,
        204,
        207,
        190,
        92
      ]
    },
    {
      "name": "swapExecuted",
      "discriminator": [
        150,
        166,
        26,
        225,
        28,
        89,
        38,
        79
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidInitialDeposit",
      "msg": "Initial deposits must be greater than zero"
    },
    {
      "code": 6001,
      "name": "insufficientLiquidity",
      "msg": "Insufficient liquidity in pool"
    },
    {
      "code": 6002,
      "name": "invalidFeeParameters",
      "msg": "Invalid fee parameters"
    },
    {
      "code": 6003,
      "name": "insufficientPoolReserves",
      "msg": "Insufficient pool reserves"
    },
    {
      "code": 6004,
      "name": "calculationOverflow",
      "msg": "Overflow detected in calculation"
    },
    {
      "code": 6005,
      "name": "ratioImbalance",
      "msg": "Pool ratio imbalance exceeds tolerance"
    },
    {
      "code": 6006,
      "name": "insufficientLpBalance",
      "msg": "Insufficient LP token balance"
    },
    {
      "code": 6007,
      "name": "invalidAmount",
      "msg": "Invalid amount: must be greater than zero"
    },
    {
      "code": 6008,
      "name": "slippageTooHigh",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6009,
      "name": "insufficientBalance",
      "msg": "Insufficient user token balance"
    },
    {
      "code": 6010,
      "name": "orderNotFound",
      "msg": "Limit order not found"
    },
    {
      "code": 6011,
      "name": "invalidOrderStatus",
      "msg": "Invalid order status for this operation"
    },
    {
      "code": 6012,
      "name": "orderExpired",
      "msg": "Limit order has expired"
    },
    {
      "code": 6013,
      "name": "unauthorizedOrderOwner",
      "msg": "Only order owner can cancel"
    },
    {
      "code": 6014,
      "name": "priceConditionNotMet",
      "msg": "Price condition not met for execution"
    },
    {
      "code": 6015,
      "name": "invalidExpiryTime",
      "msg": "Invalid expiry time"
    },
    {
      "code": 6016,
      "name": "invalidAuthority",
      "msg": "Invalid authority - must be configured authority"
    },
    {
      "code": 6017,
      "name": "rewardsPaused",
      "msg": "RUSH rewards are currently paused"
    },
    {
      "code": 6018,
      "name": "invalidApy",
      "msg": "Invalid APY configuration"
    },
    {
      "code": 6019,
      "name": "supplyExhausted",
      "msg": "RUSH token supply exhausted"
    },
    {
      "code": 6020,
      "name": "deadlineExceeded",
      "msg": "Transaction deadline exceeded"
    },
    {
      "code": 6021,
      "name": "invalidVault",
      "msg": "Invalid vault - must be pool's token vault"
    },
    {
      "code": 6022,
      "name": "invalidPool",
      "msg": "Invalid pool - order does not belong to this pool"
    },
    {
      "code": 6023,
      "name": "invalidMint",
      "msg": "Invalid LP mint - must be pool's LP token mint"
    }
  ],
  "types": [
    {
      "name": "limitOrder",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "sellToken",
            "type": "pubkey"
          },
          {
            "name": "buyToken",
            "type": "pubkey"
          },
          {
            "name": "sellAmount",
            "type": "u64"
          },
          {
            "name": "targetPrice",
            "type": "u64"
          },
          {
            "name": "minimumReceive",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "orderStatus"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "orderId",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "limitOrderCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "refundedAmount",
            "type": "u64"
          },
          {
            "name": "cancelledAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "limitOrderCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "sellToken",
            "type": "pubkey"
          },
          {
            "name": "buyToken",
            "type": "pubkey"
          },
          {
            "name": "sellAmount",
            "type": "u64"
          },
          {
            "name": "targetPrice",
            "type": "u64"
          },
          {
            "name": "minimumReceive",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "limitOrderExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "order",
            "type": "pubkey"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "sellAmount",
            "type": "u64"
          },
          {
            "name": "receiveAmount",
            "type": "u64"
          },
          {
            "name": "executionPrice",
            "type": "u64"
          },
          {
            "name": "executedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "liquidityAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "amountA",
            "type": "u64"
          },
          {
            "name": "amountB",
            "type": "u64"
          },
          {
            "name": "lpTokensMinted",
            "type": "u64"
          },
          {
            "name": "newReserveA",
            "type": "u64"
          },
          {
            "name": "newReserveB",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "liquidityPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "tokenAMint",
            "type": "pubkey"
          },
          {
            "name": "tokenBMint",
            "type": "pubkey"
          },
          {
            "name": "tokenAVault",
            "type": "pubkey"
          },
          {
            "name": "tokenBVault",
            "type": "pubkey"
          },
          {
            "name": "lpTokenMint",
            "type": "pubkey"
          },
          {
            "name": "reserveA",
            "type": "u64"
          },
          {
            "name": "reserveB",
            "type": "u64"
          },
          {
            "name": "totalLpSupply",
            "type": "u64"
          },
          {
            "name": "feeNumerator",
            "type": "u64"
          },
          {
            "name": "feeDenominator",
            "type": "u64"
          },
          {
            "name": "tokenADecimals",
            "type": "u8"
          },
          {
            "name": "tokenBDecimals",
            "type": "u8"
          },
          {
            "name": "isStablecoinPool",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "totalVolumeA",
            "type": "u64"
          },
          {
            "name": "totalVolumeB",
            "type": "u64"
          },
          {
            "name": "lockedLiquidity",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "liquidityRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "lpTokensBurned",
            "type": "u64"
          },
          {
            "name": "amountAReceived",
            "type": "u64"
          },
          {
            "name": "amountBReceived",
            "type": "u64"
          },
          {
            "name": "newReserveA",
            "type": "u64"
          },
          {
            "name": "newReserveB",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pending"
          },
          {
            "name": "executed"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "expired"
          }
        ]
      }
    },
    {
      "name": "poolCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "tokenAMint",
            "type": "pubkey"
          },
          {
            "name": "tokenBMint",
            "type": "pubkey"
          },
          {
            "name": "reserveA",
            "type": "u64"
          },
          {
            "name": "reserveB",
            "type": "u64"
          },
          {
            "name": "lpTokenSupply",
            "type": "u64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rewardsClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "position",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "rewardsAmount",
            "type": "u64"
          },
          {
            "name": "rewardsDisplay",
            "type": "f64"
          },
          {
            "name": "timeElapsed",
            "type": "i64"
          },
          {
            "name": "userLpShare",
            "type": "f64"
          },
          {
            "name": "claimedAt",
            "type": "i64"
          },
          {
            "name": "totalClaimedLifetime",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "rewardsConfigUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "previousApyNumerator",
            "type": "u64"
          },
          {
            "name": "newApyNumerator",
            "type": "u64"
          },
          {
            "name": "newRewardsPerSecond",
            "type": "u64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "updatedBy",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "rewardsPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "pausedAt",
            "type": "i64"
          },
          {
            "name": "pausedBy",
            "type": "pubkey"
          },
          {
            "name": "reason",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "rushConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "mintedSoFar",
            "type": "u64"
          },
          {
            "name": "rewardsPerSecond",
            "type": "u64"
          },
          {
            "name": "apyNumerator",
            "type": "u64"
          },
          {
            "name": "apyDenominator",
            "type": "u64"
          },
          {
            "name": "startTimestamp",
            "type": "i64"
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "rushTokenInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "rushMint",
            "type": "pubkey"
          },
          {
            "name": "rushConfig",
            "type": "pubkey"
          },
          {
            "name": "totalSupply",
            "type": "u64"
          },
          {
            "name": "rewardsPerSecond",
            "type": "u64"
          },
          {
            "name": "apyNumerator",
            "type": "u64"
          },
          {
            "name": "apyDenominator",
            "type": "u64"
          },
          {
            "name": "startTimestamp",
            "type": "i64"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "swapExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "pool",
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
            "name": "feeAmount",
            "type": "u64"
          },
          {
            "name": "isAToB",
            "type": "bool"
          },
          {
            "name": "newReserveA",
            "type": "u64"
          },
          {
            "name": "newReserveB",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "userLiquidityPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "lpTokens",
            "type": "u64"
          },
          {
            "name": "depositTimestamp",
            "type": "i64"
          },
          {
            "name": "lastClaimTimestamp",
            "type": "i64"
          },
          {
            "name": "totalRushClaimed",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
