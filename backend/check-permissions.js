import axios from 'axios';

const config = {
  appId: 'cli_a9d515208f789cda',
  appSecret: 'szaS9M0Vozui9JF0i5yMAbdYTV2k0EMB',
  documentId: 'Eqy0wo8GXiHqmEkCjFmcP0ijnHb',
};

async function checkPermissions() {
  // 1. 获取 token
  const tokenRes = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      app_id: config.appId,
      app_secret: config.appSecret,
    }
  );
  
  const token = tokenRes.data.tenant_access_token;
  console.log('✅ Token obtained');
  
  // 2. 尝试不同的 API 端点来创建块
  const endpoints = [
    {
      name: '创建子块 (POST /blocks/{block_id}/children)',
      url: `https://open.feishu.cn/open-apis/docx/v1/documents/${config.documentId}/blocks/${config.documentId}/children`,
      method: 'POST',
      data: {
        children: [
          {
            block_type: 2,
            text: {
              elements: [
                {
                  text_run: {
                    content: '测试内容',
                  }
                }
              ]
            }
          }
        ],
        index: -1
      }
    },
    {
      name: '批量创建块 (POST /blocks/batch_create)',
      url: `https://open.feishu.cn/open-apis/docx/v1/documents/${config.documentId}/blocks/batch_create`,
      method: 'POST',
      data: {
        children: [
          {
            block_type: 2,
            text: {
              elements: [
                {
                  text_run: {
                    content: '测试内容',
                  }
                }
              ]
            }
          }
        ],
        index: -1
      }
    }
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n测试: ${endpoint.name}`);
    console.log(`URL: ${endpoint.url}`);
    
    try {
      const response = await axios.post(
        endpoint.url,
        endpoint.data,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );
      
      console.log(`✅ 成功! Code: ${response.data.code}`);
      if (response.data.code === 0) {
        console.log('🎉 找到可用的 API 端点!');
        return;
      }
    } catch (error) {
      console.log(`❌ 失败! Status: ${error.response?.status}`);
      console.log(`   Code: ${error.response?.data?.code}`);
      console.log(`   Msg: ${error.response?.data?.msg}`);
      
      if (error.response?.data?.code === 1770032) {
        console.log('   ⚠️  权限不足 - 需要 docx:document 编辑权限');
      }
    }
  }
}

checkPermissions().catch(console.error);
