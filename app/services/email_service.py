import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import settings

class EmailService:
    """邮件发送服务"""
    
    def __init__(self):
        """初始化SMTP配置"""
        self.smtp_host: Optional[str] = None
        self.smtp_port: int = 587
        self.smtp_user: Optional[str] = None
        self.smtp_password: Optional[str] = None
        self.smtp_from: Optional[str] = None
        self.smtp_use_tls: bool = True
        
    async def configure(self, config):
        """从系统配置更新SMTP设置"""
        self.smtp_host = config.smtp_host
        self.smtp_port = config.smtp_port or 587
        self.smtp_user = config.smtp_user
        self.smtp_password = config.smtp_password
        self.smtp_from = config.smtp_from or config.smtp_user
        self.smtp_use_tls = config.smtp_use_tls if hasattr(config, 'smtp_use_tls') else True
        
    def is_configured(self) -> bool:
        """检查SMTP是否已配置"""
        return all([
            self.smtp_host,
            self.smtp_user,
            self.smtp_password,
        ])
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """
        发送邮件
        
        Args:
            to_email: 收件人邮箱
            subject: 邮件主题
            html_content: HTML内容
            text_content: 纯文本内容（可选）
            
        Returns:
            发送是否成功
        """
        if not self.is_configured():
            raise Exception("SMTP not configured")
        
        try:
            # 创建邮件
            message = MIMEMultipart('alternative')
            message['Subject'] = subject
            message['From'] = self.smtp_from
            message['To'] = to_email
            
            # 添加纯文本部分
            if text_content:
                part1 = MIMEText(text_content, 'plain', 'utf-8')
                message.attach(part1)
            
            # 添加HTML部分
            part2 = MIMEText(html_content, 'html', 'utf-8')
            message.attach(part2)
            
            # 发送邮件
            async with aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=self.smtp_use_tls
            ) as smtp:
                await smtp.login(self.smtp_user, self.smtp_password)
                await smtp.send_message(message)
            
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return False
    
    async def send_verification_email(
        self,
        to_email: str,
        code: str,
        site_name: str = "Gproxy"
    ) -> bool:
        """
        发送验证码邮件
        
        Args:
            to_email: 收件人邮箱
            code: 验证码
            site_name: 网站名称
            
        Returns:
            发送是否成功
        """
        subject = f"{site_name} - 邮箱验证码"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #667eea; 
                        text-align: center; padding: 20px; background: white; 
                        border-radius: 8px; letter-spacing: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #999; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{site_name}</h1>
                    <p>邮箱验证</p>
                </div>
                <div class="content">
                    <p>您好，</p>
                    <p>您正在进行邮箱验证，您的验证码是：</p>
                    <div class="code">{code}</div>
                    <p>验证码有效期为 <strong>5分钟</strong>，请尽快完成验证。</p>
                    <p>如果这不是您的操作，请忽略此邮件。</p>
                </div>
                <div class="footer">
                    <p>此邮件由系统自动发送，请勿回复</p>
                    <p>&copy; {site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {site_name} - 邮箱验证
        
        您好，
        
        您正在进行邮箱验证，您的验证码是：{code}
        
        验证码有效期为 5分钟，请尽快完成验证。
        
        如果这不是您的操作，请忽略此邮件。
        
        ---
        此邮件由系统自动发送，请勿回复
        © {site_name}
        """
        
        return await self.send_email(to_email, subject, html_content, text_content)
    
    async def send_password_reset_email(
        self,
        to_email: str,
        code: str,
        site_name: str = "Gproxy"
    ) -> bool:
        """
        发送密码重置邮件
        
        Args:
            to_email: 收件人邮箱
            code: 验证码
            site_name: 网站名称
            
        Returns:
            发送是否成功
        """
        subject = f"{site_name} - 密码重置验证码"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
                          color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
                .code {{ font-size: 32px; font-weight: bold; color: #f5576c; 
                        text-align: center; padding: 20px; background: white; 
                        border-radius: 8px; letter-spacing: 8px; margin: 20px 0; }}
                .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; 
                           padding: 10px; margin: 15px 0; }}
                .footer {{ text-align: center; margin-top: 20px; color: #999; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{site_name}</h1>
                    <p>密码重置</p>
                </div>
                <div class="content">
                    <p>您好，</p>
                    <p>您正在重置账户密码，您的验证码是：</p>
                    <div class="code">{code}</div>
                    <div class="warning">
                        <strong>⚠️ 安全提示</strong><br>
                        验证码有效期为 <strong>5分钟</strong>。<br>
                        如果这不是您的操作，请立即修改密码并联系管理员。
                    </div>
                </div>
                <div class="footer">
                    <p>此邮件由系统自动发送，请勿回复</p>
                    <p>&copy; {site_name}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        {site_name} - 密码重置
        
        您好，
        
        您正在重置账户密码，您的验证码是：{code}
        
        ⚠️ 安全提示
        验证码有效期为 5分钟。
        如果这不是您的操作，请立即修改密码并联系管理员。
        
        ---
        此邮件由系统自动发送，请勿回复
        © {site_name}
        """
        
        return await self.send_email(to_email, subject, html_content, text_content)

# 全局邮件服务实例
email_service = EmailService()
